# Plektos

## About Plektos

Plektos is a decentralized meetup platform built on Nostr. It enables users to create, join, and manage event. As a decentralized application, Plektos gives users full control over their data and event management without relying on centralized services.

## Features

### Event Management

- 🎯 Create and manage events with detailed information
- 📅 Schedule and organize meetups
- 📍 Location-based event discovery
- ⚡ Use Zaps to pay for event tickets

### Privacy & Security

- 🛡️ Decentralized data storage through Nostr
- 🔒 User-controlled data and privacy settings
- 🎭 Optional anonymous participation

### Technical Features

- 🚀 Built with React 18 and Vite for optimal performance
- 🎨 Modern UI components using shadcn/ui and TailwindCSS
- 📱 Responsive design for all devices
- 🌙 Dark mode support
- 🔄 Real-time updates
- 🔍 Advanced search capabilities

## Tech Stack

- **Frontend Framework**: React 18.x
- **Styling**: TailwindCSS 3.x
- **Build Tool**: Vite
- **UI Components**: shadcn/ui
- **Nostr Integration**: Nostrify
- **State Management**: TanStack Query
- **Routing**: React Router
- **Type Safety**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn package manager

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/derekross/plektos.git
   cd plektos
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code with Prettier

### Project Structure

```
plektos/
├── src/
│   ├── components/     # UI components
│   ├── hooks/         # Custom React hooks
│   ├── pages/         # Page components
│   ├── lib/           # Utility functions
│   └── main.tsx       # Application entry point
├── public/            # Static assets
└── package.json       # Project dependencies
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [shadcn/ui](https://ui.shadcn.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [React](https://reactjs.org/)
