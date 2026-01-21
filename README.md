# Firestore JSON Downloader

A lightweight Chrome Extension that allows you to copy Firestore documents as JSON directly from the Firebase Console or local Firestore Emulator with a single click.

## Features

- **On-Page Integration**: Adds a "Copy JSON" button directly into the Firestore UI, strictly positioned next to the "Add field" button.
- **Production & Emulator Support**: Works seamlessly on `console.firebase.google.com` and local emulator suites (`localhost` or `127.0.0.1`).
- **Sub-collection Awareness**: Automatically detects and adds copy buttons to all open panels, including parent documents and nested sub-collections.
- **Intelligent Parsing**: Correctly handles complex data structures including:
  - Nested Maps
  - Arrays
  - Timestamps, Booleans, and Null values
- **Zero External Calls**: The extension is entirely local and privacy-focused. No data ever leaves your browser.
- **Visual Feedback**: Provides immediate feedback ("Copied!") when a document is successfully saved to your clipboard.

## Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the root directory of this project.

## How to Use

1. Navigate to your Firestore database in the Firebase Console or open your local Firestore emulator.
2. Select any document.
3. Locate the **Copy JSON** button (placed next to the "Add field" button).
4. Click the button to copy the document's content as a formatted JSON object to your clipboard.

## Permissions

- `scripting`: Used to inject the parsing logic and the copy button into the Firestore interface.
- URL Matches: Limited strictly to Firebase Console and local emulator addresses.

## License

MIT
