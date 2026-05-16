package middleware

import "net/http"

// SecurityHeaders sets defense-in-depth response headers on every API response.
// HSTS only takes effect over HTTPS but is harmless on plain HTTP, and the
// no-sniff / DENY headers guard against the rare browser that touches the API.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// BodyLimit wraps r.Body with http.MaxBytesReader so any handler that reads
// the body fails fast on oversize payloads instead of buffering them in memory.
// The largest legitimate request is a workout create with GPS + HR samples
// (a 3h ride is ~1–2 MB); 8 MB leaves comfortable headroom while still capping
// memory exhaustion vectors.
func BodyLimit(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}
