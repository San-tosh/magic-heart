# Sona's Magic Heart ❤️

A creative 3D website for Sona Thokar Tamang, featuring particles of love and gesture control.

## Features
- **3D Heart Particles**: A beautiful cloud of particles forming a heart.
- **Personalized**: Displays "Sona Thokar Tamang" in 3D.
- **Gesture Control**: Use your webcam to control the zoom!
  - **Pinch In** (Thumb & Index close): Zoom In
  - **Pinch Out** (Thumb & Index apart): Zoom Out (or vice versa, it's distance based!)

## How to Run

Since this project uses modern web features (ES Modules and Webcam access), it needs to be served by a local web server. Opening `index.html` directly in the browser might not work due to security restrictions.

### Option 1: Python (easiest if installed)
1. Open a terminal in this folder.
2. Run:
   ```bash
   python3 -m http.server
   ```
3. Open your browser to `http://localhost:8000`

### Option 2: Node.js
1. Install a simple server:
   ```bash
   npx serve
   ```
2. Open the URL shown (usually `http://localhost:3000`).

### Option 3: VS Code
- Install the "Live Server" extension.
- Right-click `index.html` and select "Open with Live Server".

## Note
- **Allow Camera Access**: When prompted, allow the browser to access your webcam for the gesture control to work.
- The hand tracking runs locally in your browser using MediaPipe.

