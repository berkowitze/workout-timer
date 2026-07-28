# Workout Parse Benchmark Results

_Generated: 2026-07-27 20:37:59_

| Provider | Model | Structured | Simple (s) | Complex (s) | Errors |
|----------|-------|-----------|-----------|------------|--------|
| openai | gpt-4o-mini | no | skip | skip |  |
| openai | gpt-4o-mini | yes | skip | skip |  |
| openai | gpt-4.1-mini | no | skip | skip |  |
| openai | gpt-4.1-mini | yes | skip | skip |  |
| openai | gpt-4.1-nano | no | ERR | skip | Expecting ',' delimiter: line 1 column 222 (char 221) |
| openai | gpt-4.1-nano | yes | skip | skip |  |
| anthropic | claude-haiku-4-5 | no | skip | skip |  |
| google | gemini-2.5-flash | no | skip | skip |  |
| google | gemini-2.5-flash | yes | skip | skip |  |
| google | gemini-2.5-flash-lite | no | skip | skip |  |
| google | gemini-2.5-flash-lite | yes | skip | skip |  |
| groq | llama-3.3-70b | no | skip | skip |  |
| groq | llama-3.3-70b | yes | skip | skip |  |
| groq | llama-3.1-8b | no | skip | skip |  |
| groq | llama-3.1-8b | yes | skip | skip |  |
| cerebras | llama3.1-8b | no | skip | skip |  |
| cerebras | llama3.1-8b | yes | skip | skip |  |
| google | gemini-3.6-flash | no | ERR | ERR | 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}}; 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}} |
| google | gemini-3.6-flash | yes | ERR | ERR | 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}}; 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}} |
| google | gemini-3.5-flash-lite | no | ERR | ERR | 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}}; 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}} |
| cerebras | gpt-oss-120b | no | 0.66 | 120.12 |  |
| google | gemini-3.5-flash-lite | yes | ERR | ERR | 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}}; 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': 'API_KEY_INVALID', 'domain': 'googleapis.com', 'metadata': {'service': 'generativelanguage.googleapis.com'}}, {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': 'API key not valid. Please pass a valid API key.'}]}} |
| groq | gpt-oss-20b | no | 0.88 | 1.67 |  |
| openai | gpt-5.4-mini | no | 1.44 | 2.42 |  |
| groq | gpt-oss-20b | yes | 0.92 | 2.76 |  |
| openai | gpt-5.4-mini | yes | 1.98 | 3.03 |  |
| openai | gpt-5.4-nano | no | 1.20 | 2.15 |  |
| openai | gpt-5.4-nano | yes | 1.71 | 5.58 |  |
| cerebras | gpt-oss-120b | yes | 59.45 | 0.54 |  |

_* = invalid JSON output, ERR = request failed_
