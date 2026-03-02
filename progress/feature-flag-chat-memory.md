## Feature Flag: Chat Memory — Done
- Chat memory/summarization gated behind `ENABLE_CHAT_MEMORY` env var (default off). When disabled, memory is not loaded, conversations are not summarized on clear, and no memory is injected into prompts. Set to `"false"` in docker-compose.yml.
