# OllyChat

OllyChat is an open source AI tool to chat with your observability data and run devops tasks.

You can try OllyChat by pointing it at our demo Prometheus server: <http://34.123.158.139:9090>

## Features

- Chat with your observability data
- Build custom AI agents for DevOps
- [See a few questions you can ask](DEMO.md)

## OllyChat in CLI

![CLI Demo](https://raw.githubusercontent.com/alexkroman/ollychat/refs/heads/main/public/cli-demo-2.gif)

## OllyChat in Slack

![Slack Demo](https://github.com/alexkroman/ollychat/blob/main/public/slack-demo.gif?raw=true)

## Supported Observability Platforms

- Prometheus
- New Relic (coming soon)
- DataDog (coming soon)
- Elastic (coming soon)

## Supported LLM's

- OpenAI
- Anthropic

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/alexkroman/ollychat.git

cd ollychat

# Install dependencies
npm install

# Set up configuration
cp env-example.sh .env
```

### Configuration

Edit `.env` with your settings

### Asking Questions in the CLI

```bash
# Start the CLI
npm run cli:start

# Example questions
> what's the health status of my cluster?
> any alerts?
> which pods are consuming the most memory?
```

### Optional Slack Integration

1. Create a Slack App:
   - Visit [Slack API](https://api.slack.com/apps)
   - Click "Create New App" → "From an app manifest"
   - Select your workspace
   - Copy JSON in `deploy/slack/slack-manifest.json`

2. Install the app to your workspace:
   - Navigate to "Install App" in your Slack App settings
   - Click "Install to Workspace"
   - Grant requested permissions

3. Start the Slack bot:
  
   ```bash
   # Start the Slack backend
   npm run slack:start
   ```

### Building Slack app with Docker

You can use Docker to deploy the Slack app:

   ```bash
   # Start the Slack backend
   npm run docker:compose:up
   ```

### Asking Questions in Slack

Invite @olly to your team or incident channel.

- @olly what's the health status of my cluster?
- @olly any alerts?
- @olly which pods are consuming the most memory?

## Contributing

### Building your own DevOps AI Agent with OllyChat

- You can use src/tools/prometheus.ts as a template to get started

```bash
   cp src/tools/prometheus.ts src/tools/newTool.ts
```

- Add your tool as an import and to the tools array in src/tools/index.ts

### Run tests

```bash
npm test
```

### Run linter

```bash
npm run lint
```

### Generate evaluation run

When you make changes to the app you should generate an evaluation run to test your change against ground truths.

```bash
# Load the latest version of the evaluation data
npm run evals:load

# Run the evaluations
npm run evals:start
```

## License

Ollychat is MIT licensed. See [LICENSE](LICENSE) for details.
