package middleware

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

// sensitiveQueryKeys are query parameters whose values are stripped from
// access logs. The WebSocket handshake passes the bearer JWT as `?token=...`,
// which would otherwise leak into stdout, log aggregators, and reverse-proxy
// access logs.
var sensitiveQueryKeys = map[string]struct{}{
	"token":         {},
	"access_token":  {},
	"refresh_token": {},
	"code":          {},
}

// RequestLogger emits a structured log line per request via zerolog. It mirrors
// chi's default Logger but redacts sensitive query parameters before writing.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
		start := time.Now()
		defer func() {
			log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("query", redactQuery(r.URL.RawQuery)).
				Int("status", ww.Status()).
				Int("bytes", ww.BytesWritten()).
				Dur("duration", time.Since(start)).
				Str("remote", r.RemoteAddr).
				Msg("http request")
		}()
		next.ServeHTTP(ww, r)
	})
}

func redactQuery(raw string) string {
	if raw == "" {
		return ""
	}
	values, err := url.ParseQuery(raw)
	if err != nil {
		return ""
	}
	changed := false
	for k, vs := range values {
		if _, sensitive := sensitiveQueryKeys[strings.ToLower(k)]; !sensitive {
			continue
		}
		for i := range vs {
			vs[i] = "[REDACTED]"
		}
		values[k] = vs
		changed = true
	}
	if !changed {
		return raw
	}
	return values.Encode()
}
