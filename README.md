# Sparky AI Bot - Telegram Bot with OpenRouter

A Telegram bot that connects users to OpenRouter AI models. Built using Telegram's serverless platform (tgcloud).

## Features

- 💬 Chat with various AI models from OpenRouter
- 🎯 Multiple model support (GPT-4, Claude, Mistral, etc.)
- ⚙️ Customizable settings per user
- 💾 Conversation history saved in database
- 📊 Token usage statistics
- 🎨 Markdown formatting support

## Quick Start

### Prerequisites

1. [Node.js](https://nodejs.org/) (v18 or later)
2. A Telegram bot token from [@BotFather](https://t.me/BotFather)
3. An OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/voltagestudiosHQ/sparkytg.git
   cd sparkytg
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Link your bot to the project:
   ```bash
   npx tgcloud login
   ```
   (Follow the prompts to authenticate with Telegram)

5. Deploy your bot:
   ```bash
   npm run deploy
   ```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and get welcome message |
| `/help` | Show all available commands |
| `/new` | Start a new conversation |
| `/clear` | Clear current conversation |
| `/settings` | Show your current settings |
| `/model <name>` | Switch AI model |
| `/models` | List available models |
| `/temp <0-100>` | Set temperature (creativity) |
| `/maxtokens <1-8192>` | Set max tokens per response |
| `/stats` | Toggle token usage display |

### Chatting

Just send a message! The bot will:
1. Create a new conversation (if none active)
2. Send your message to OpenRouter
3. Return the AI response
4. Save the conversation history

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | Required |
| `DEFAULT_MODEL` | Default model for new users | `openai/gpt-4o-mini` |
| `DEFAULT_TEMPERATURE` | Default temperature | `70` |
| `DEFAULT_MAX_TOKENS` | Default max tokens | `4096` |

### Settings

Each user has their own settings stored in the database:
- **Model**: Which AI model to use
- **Temperature**: Creativity level (0-100)
- **Max Tokens**: Maximum tokens per response
- **Show Stats**: Whether to display token usage

## Project Structure

```
tgcloud/
├── schema.js           # Database schema definition
├── handlers/
│   ├── message.js      # Main message handler
│   ├── start.js        # /start command handler
│   ├── help.js         # /help command handler
│   └── callback_query.js # Inline button handler
├── lib/
│   ├── openrouter.js   # OpenRouter API client
│   └── utils.js        # Utility functions
└── endpoints/          # Mini App endpoints (if used)
```

## Database Schema

The bot uses SQLite with the following tables:

- **users**: Telegram user information
- **settings**: User preferences
- **conversations**: Chat conversations
- **messages**: Individual messages in conversations

## Development

### Local Testing

Use the `tgcloud run` command to test handlers locally:

```bash
# Test message handler
npx tgcloud run handlers/message '{"text":"Hello","from":{"id":123},"chat":{"id":123}}'

# Test with custom context
npx tgcloud run handlers/message '{"text":"/start","from":{"id":123},"chat":{"id":123}}'
```

### Adding New Features

1. Add new handler files in `tgcloud/handlers/`
2. Import and use the SDK (`db`, `api`, `fetch`)
3. Deploy with `npm run deploy`

## Models

The bot supports any model available on OpenRouter. Some popular options:

- `openai/gpt-4o-mini` - Fast, affordable
- `openai/gpt-4o` - More capable
- `anthropic/claude-3-haiku` - Claude 3
- `mistralai/mistral-7b` - Open source
- `google/gemini-flash-1.5` - Google's model

Use `/models` to see the full list of available models.

## Troubleshooting

### API Key Issues

Make sure your OpenRouter API key is set in the environment:
```bash
npx tgcloud run handlers/message '{"text":"/start","from":{"id":1},"chat":{"id":1}}'
```

If you get "OPENROUTER_API_KEY is required", check your `.env` file.

### Database Migrations

After changing `tgcloud/schema.js`:
1. Run `npm run deploy` to deploy the schema changes
2. Run `npx tgcloud migrate` to apply database migrations

## License

MIT License - Feel free to use and modify this bot for your own purposes.

## Contributing

Pull requests are welcome! Please open an issue first for major changes.

## Support

For issues or questions:
- Open a GitHub issue
- Check the [Telegram Bot API documentation](https://core.telegram.org/bots/api)
- Check the [OpenRouter documentation](https://openrouter.ai/docs)
