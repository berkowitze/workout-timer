# Workout Parse Benchmark Results

_Generated: 2026-02-25 15:33:11_

| Provider | Model | Structured | Simple (s) | Complex (s) | Errors |
|----------|-------|-----------|-----------|------------|--------|
| groq | llama-3.3-70b | no | 0.65 | 1.04 |  |
| anthropic | claude-haiku-4-5 | no | 0.94 | 2.13 |  |
| groq | llama-3.3-70b | yes | 0.52 | 0.81 |  |
| groq | llama-3.1-8b | no | 0.40 | 0.56 |  |
| openai | gpt-4o-mini | no | 2.14 | 6.30 |  |
| groq | llama-3.1-8b | yes | 0.70 | 0.76 |  |
| google | gemini-2.5-flash | no | 2.58 | 6.14 |  |
| openai | gpt-4o-mini | yes | 4.34 | 18.25 |  |
| cerebras | llama3.1-8b | no | 4.39 | 4.45 |  |
| google | gemini-2.5-flash | yes | 2.39 | 9.76 |  |
| openai | gpt-4.1-mini | no | 1.18 | 18.80 |  |
| google | gemini-2.5-flash-lite | no | 0.72 | 1.31 |  |
| cerebras | llama3.1-8b | yes | 3.17 | 3.54 |  |
| google | gemini-2.5-flash-lite | yes | 0.84 | 2.58 |  |
| openai | gpt-4.1-mini | yes | 12.64 | 12.18 |  |
| openai | gpt-4.1-nano | no | ERR | 6.91 | Expecting ',' delimiter: line 1 column 222 (char 221) |
| openai | gpt-4.1-nano | yes | 5.37 | 15.10 |  |

_* = invalid JSON output, ERR = request failed_
