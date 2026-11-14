# Sparky AI Bot - Telegram Bot with OpenRouter

A Telegram bot that connects users to OpenRouter AI models. Built using Telegram's serverless platform (tgcloud).

## Features

- 💬 Chat with OpenRouter's `@preset/sparky` model
- 🤝 Casual, friendly assistant persona
- 💾 Conversation history saved in database
- ⚡ Streaming draft replies with a Stop button in private chats

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
| --------- | ------------- |
| `/start` | Start the bot and get welcome message |
| `/new` | Delete all conversation history and start fresh |
| `/help` | Show help |

### Chatting

Just send a message! The bot will:

1. Send your message (with the last 20 messages for context) to OpenRouter
2. Show a streaming draft in private chats, which you can stop while it is generating
3. Send the completed response and save the conversation history

Use `/new` any time to delete all stored conversation history and start fresh.

Streaming drafts are temporary previews. Completed replies are sent as regular
messages so they remain in the chat. If you stop generation, the partial reply
is sent and saved when any text has been generated.

## Configuration

### Secrets Management

The tgcloud runtime has no environment variables. All secrets must be placed in `tgcloud/lib/secrets.js` (git-ignored, deployed with the bot).

**Local Setup:**

1. Copy the example secrets file:

   ```bash
   cp tgcloud/lib/secrets.example.js tgcloud/lib/secrets.js
   ```

   or use the helper script:

   ```bash
   ./addkey.sh OPENROUTER_KEY "your-actual-openrouter-key"
   ./addkey.sh SYSTEM_PROMPT "You are Sparky, a casual, friendly, and helpful assistant..."
   ```

   or if you use powershell

   ```powershell
   .\addkey.ps1 OPENROUTER_KEY "your-actual-openrouter-key"
   .\addkey.ps1 SYSTEM_PROMPT "You are Sparky, a whimsical AI sidekick with a penchant for wild tangents and unfiltered honesty..."
   ```

   `SYSTEM_PROMPT` is an **optional** override for the bot's persona. Sparky's built-in persona lives in `tgcloud/lib/persona.js`; leave `SYSTEM_PROMPT` empty to use it, or set it (via `addkey.sh` + `npx tgcloud push`, or the `SYSTEM_PROMPT` GitHub Actions secret) to change Sparky's behavior with no code edits. Apostrophes and multi-line prompts are handled.

2. Then authenticate with Telegram:

   ```bash
   npx tgcloud login
   ```

**GitHub Actions Secrets to Configure:**

- `OPENROUTER_KEY` - Your OpenRouter API key (shared by both beta and prod bots)
- `SYSTEM_PROMPT` - Optional persona/instructions override (built-in persona is in `tgcloud/lib/persona.js`)
- `TGCLOUD_TOKEN_BETA` - Telegram CLI access token for beta bot (@BotFather -> Serverless -> CLI Access)
- `TGCLOUD_TOKEN_PROD` - Telegram CLI access token for production bot (@BotFather -> Serverless -> CLI Access)

> **Note:** If any real key was previously committed to git history, rotate it immediately (revoke + regenerate) as it persists in history regardless.

### Model

The bot always uses OpenRouter's `@preset/sparky` model. There are no per-user settings to configure — just chat. Sparky's personality comes from the built-in persona in `tgcloud/lib/persona.js`, optionally overridden by the `SYSTEM_PROMPT` secret.

## Project Structure

```structure
tgcloud/
├── schema.js           # Database schema definition
├── handlers/
│   └── message.js      # Message + command handler
└── lib/
    └── openrouter.js   # OpenRouter API client
```

## Database Schema

The bot uses SQLite with the following tables:

- **users**: Telegram user information
- **conversations**: Chat conversations
- **messages**: Individual messages in conversations

## Development

### Local Testing

Use the `tgcloud run` command to test handlers locally:

```bash
# First, set up your secrets:
cp tgcloud/lib/secrets.example.js tgcloud/lib/secrets.js
# Edit tgcloud/lib/secrets.js with your OPENROUTER_KEY

# Then test handlers:
npx tgcloud run handlers/message '{"text":"Hello","from":{"id":123},"chat":{"id":123}}'

# Test with custom context
npx tgcloud run handlers/message '{"text":"/start","from":{"id":123},"chat":{"id":123}}'
```

### Adding New Features

1. Add new handler files in `tgcloud/handlers/`
2. Import and use the SDK (`db`, `api`, `fetch`)
3. Deploy with `npm run deploy`

## Deployment

### CI/CD Workflows

The project includes GitHub Actions workflows for automated deployment:

- **`deploy-beta.yml`**: Deploys to beta on every push to `main` branch
- **`deploy-prod.yml`**: Deploys to production on version tags (`v*`)

Both workflows:

1. Check out the repository
2. Set up Node.js 20
3. Install dependencies with `npm ci`
4. Inject the OpenRouter key using `addkey.sh`
5. Deploy with `npx tgcloud push` using the appropriate TGCLOUD_TOKEN

### Manual Deployment

```bash
# Deploy beta
npx tgcloud push

# Or with explicit token
TGCLOUD_TOKEN=your-beta-token npx tgcloud push
```

## Models

The bot always uses OpenRouter's `@preset/sparky` model. It cannot be changed.

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

Streaming replies add a `message_generations` table, so apply this migration
after deploying the updated schema.

## License

MIT License - Feel free to use and modify this bot for your own purposes.

## Contributing

Pull requests are welcome! Please open an issue first for major changes.

## Support

For issues or questions:

- Open a GitHub issue
- Check the [Telegram Bot API documentation](https://core.telegram.org/bots/api)
- Check the [OpenRouter documentation](https://openrouter.ai/docs)
