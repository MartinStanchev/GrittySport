package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// IPRateLimiter is an in-process per-IP token bucket. It exists to throttle
// unauthenticated endpoints (OTP request/verify, refresh) where the per-email
// limiter inside AuthService is bypassed by attackers cycling fresh emails —
// they'd otherwise mail-bomb arbitrary recipients via Resend with no cap.
//
// In-process state is acceptable at current scale (single API replica). If the
// service ever scales horizontally, swap this for a Redis-backed limiter.
type IPRateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*ipBucket
	rate     float64       // tokens per second
	burst    float64       // bucket capacity
	idleTTL  time.Duration // prune buckets idle longer than this
	lastSwept time.Time
}

type ipBucket struct {
	tokens float64
	last   time.Time
}

// NewIPRateLimiter creates a limiter that refills `rate` tokens per second up
// to `burst` capacity per IP. Reasonable values for /api/auth/*: rate=0.5,
// burst=30 (30 reqs immediately, then 1 every 2s — generous for legit users,
// punishing for bots).
func NewIPRateLimiter(rate, burst float64) *IPRateLimiter {
	return &IPRateLimiter{
		buckets: make(map[string]*ipBucket),
		rate:    rate,
		burst:   burst,
		idleTTL: 10 * time.Minute,
	}
}

// allow consumes one token for `ip`. Returns false when the bucket is empty.
func (l *IPRateLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	if now.Sub(l.lastSwept) > l.idleTTL {
		for k, b := range l.buckets {
			if now.Sub(b.last) > l.idleTTL {
				delete(l.buckets, k)
			}
		}
		l.lastSwept = now
	}

	b, ok := l.buckets[ip]
	if !ok {
		l.buckets[ip] = &ipBucket{tokens: l.burst - 1, last: now}
		return true
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * l.rate
	if b.tokens > l.burst {
		b.tokens = l.burst
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Middleware wraps a handler chain with per-IP throttling. Uses r.RemoteAddr
// (already normalized by chi/middleware.RealIP). Behind a real reverse proxy,
// configure RealIP with a trusted-CIDR list so attackers can't spoof XFF to
// dodge the limiter.
func (l *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		if !l.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "2")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "too many requests; please slow down",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}
