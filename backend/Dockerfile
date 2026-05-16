# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Run stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates \
 && adduser -D -u 10001 app

WORKDIR /app

COPY --from=builder --chown=app:app /app/server .
COPY --chown=app:app prompts/ ./prompts/
COPY --chown=app:app ../db/migrations/ ./migrations/

USER app

EXPOSE 8080

CMD ["./server"]
