import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

// Configuration
const PARTICLE_COUNT = 3000; // Number of particles in the heart
const ZOOM_SENSITIVITY = 0.1;
const PAN_SENSITIVITY = 0.1;
const DEFAULT_CAMERA_Z = 30;
const MIN_CAMERA_Z = 10;
const MAX_CAMERA_Z = 60;
const MAX_PAN_X = 15;

// Global Variables
let scene, camera, renderer;
let particles, namePlane; // Renamed textMesh to namePlane
let handLandmarker;
let video;
let lastVideoTime = -1;
let currentZoom = DEFAULT_CAMERA_Z;
let currentPanX = 0;
let fireworks = []; // Array to store firework particles
let lastPinchTime = 0; // Cooldown for fireworks

async function init() {
    // 1. Setup Three.js Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = DEFAULT_CAMERA_Z;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Cap DPR for mobile performance/battery
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 2. Create Heart Particles
    createHeartParticles();

    // 3. Create Name Label (2D Texture)
    createNameLabel();

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff69b4, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // 5. Handle Resize
    window.addEventListener('resize', onWindowResize);

    // 6. Start Animation Immediately (Don't wait for camera)
    animate();

    // 7. Setup MediaPipe Hand Tracking (Background)
    setupHandTracking().then(() => {
        console.log("Hand tracking ready");
    }).catch(err => {
        console.error("Hand tracking failed:", err);
        // Optional: alert("Gesture control unavailable: " + err.message);
    });
    
    // Remove loading text immediately (or change it to "Loading Camera...")
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.innerText = "Loading Hand Tracking...";
    setTimeout(() => {
        if (loadingEl) loadingEl.style.opacity = '0';
    }, 3000); // Hide text after 3s anyway
}

function createHeartParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const color = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Heart shape formula (3D variation)
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        // z = expansion * random
        
        // We use a distribution to fill the volume
        const t = Math.random() * Math.PI * 2;
        
        // Base 2D heart shape
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        
        // Scale down
        const scale = 0.5;
        x *= scale;
        y *= scale;

        // Add some 3D depth (thickness of the heart)
        // Z depends on how close we are to the center to make it puffy
        const z = (Math.random() - 0.5) * 5 * scale; 
        
        // Add some randomness/scatter to fill the heart volume
        // We randomly scale the position towards the center to fill the inside
        const fill = Math.sqrt(Math.random()); // Sqrt distribution for uniform circle fill logic
        x *= fill;
        y *= fill;
        
        positions.push(x, y, z);

        // Colors: Shades of pink and red
        const mixedColor = Math.random();
        if (mixedColor > 0.5) {
            color.setHex(0xff69b4); // Hot pink
        } else {
            color.setHex(0xff1493); // Deep pink
        }
        
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Create a simple circular texture programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // Draw a Star Shape instead of a Heart
    context.beginPath();
    const cx = 32, cy = 32, spikes = 5, outerRadius = 15, innerRadius = 7;
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    context.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        context.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        context.lineTo(x, y);
        rot += step;
    }
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
    
    context.fillStyle = "white";
    context.shadowColor = "white";
    context.shadowBlur = 10;
    context.fill();

    const sprite = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 0.5, // Good size for stars
        vertexColors: true,
        map: sprite,
        transparent: true,
        opacity: 0.8, 
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function createNameLabel() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Higher resolution canvas for even sharper text
    canvas.width = 2048; 
    canvas.height = 1024;
    
    // Text Style - Much Bigger Font
    context.font = 'bold 240px "Dancing Script", "Brush Script MT", cursive';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Enhanced Golden/Pink Gradient
    const gradient = context.createLinearGradient(0, canvas.height/2 - 100, 0, canvas.height/2 + 100);
    gradient.addColorStop(0, '#ffeb3b'); // Gold top
    gradient.addColorStop(0.3, '#ffffff'); // White shine
    gradient.addColorStop(0.6, '#ff69b4'); // Hot Pink
    gradient.addColorStop(1, '#ff1493'); // Deep Pink bottom
    
    // Stronger Text Glow
    context.shadowColor = '#ff1493';
    context.shadowBlur = 50;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    
    // Thick Outline for "Pop"
    context.lineWidth = 15;
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.strokeText("Sona Thokar Tamang", canvas.width / 2, canvas.height / 2);
    
    // Inner Glow/Second Stroke
    context.lineWidth = 5;
    context.strokeStyle = '#ff69b4';
    context.strokeText("Sona Thokar Tamang", canvas.width / 2, canvas.height / 2);
    
    // Fill Text
    context.fillStyle = gradient;
    context.fillText("Sona Thokar Tamang", canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    
    // Create a plane
    const aspectRatio = canvas.width / canvas.height;
    // Increased plane height for larger appearance in 3D space
    const planeHeight = 12; 
    const planeWidth = planeHeight * aspectRatio;
    
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    namePlane = new THREE.Mesh(geometry, material);
    namePlane.position.set(0, 0, -2); // Slightly behind the heart center
    scene.add(namePlane);
}

// Firework Class
class Firework {
    constructor(scene, x, y, z) {
        this.scene = scene;
        this.isDead = false;
        this.particles = [];
        
        const particleCount = 50 + Math.random() * 50;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const velocities = [];
        
        const hue = Math.random() * 0.2 + 0.8; // Pink/Red/Purple range (0.8-1.0)
        const baseColor = new THREE.Color().setHSL(hue, 1, 0.6);
        
        for(let i=0; i<particleCount; i++) {
            positions.push(x, y, z);
            
            colors.push(baseColor.r, baseColor.g, baseColor.b);
            
            // Random sphere velocity
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 0.2 + Math.random() * 0.3;
            
            velocities.push(
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.sin(phi) * Math.sin(theta),
                speed * Math.cos(phi)
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        this.velocities = velocities;
        
        // Simple dot texture
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(8,8,4,0,Math.PI*2); ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);
        
        this.material = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            map: texture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        });
        
        this.mesh = new THREE.Points(geometry, this.material);
        this.scene.add(this.mesh);
        this.age = 0;
        this.lifespan = 60; // Frames
    }
    
    update() {
        this.age++;
        if (this.age > this.lifespan) {
            this.isDead = true;
            this.scene.remove(this.mesh);
            this.geometry?.dispose();
            this.material?.dispose();
            return;
        }
        
        const positions = this.mesh.geometry.attributes.position.array;
        
        for(let i=0; i < this.velocities.length/3; i++) {
            positions[i*3] += this.velocities[i*3];
            positions[i*3+1] += this.velocities[i*3+1];
            positions[i*3+2] += this.velocities[i*3+2];
            
            // Gravity
            this.velocities[i*3+1] -= 0.005;
            // Drag
            this.velocities[i*3] *= 0.98;
            this.velocities[i*3+1] *= 0.98;
            this.velocities[i*3+2] *= 0.98;
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.material.opacity = 1 - (this.age / this.lifespan);
    }
}

async function setupHandTracking() {
    video = document.getElementById('webcam');
    // Helps autoplay on mobile (iOS requires muted for autoplay)
    video.muted = true;
    
    // Check if webcam is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Webcam not supported in this browser.");
        return;
    }

    try {
        const isMobile = window.matchMedia('(max-width: 640px)').matches;
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: isMobile ? 480 : 640 }, // Lower res for stability
                height: { ideal: isMobile ? 360 : 480 },
            },
        });
        video.srcObject = stream;
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // Critical for MediaPipe on mobile: set explicit video dimensions
                video.width = video.videoWidth;
                video.height = video.videoHeight;
                video.play();
                resolve();
            };
        });
    } catch (e) {
        console.error("Camera access denied or error:", e);
        alert("Camera access required for gesture control.");
        return;
    }

    // Initialize MediaPipe HandLandmarker
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Animate particles (heartbeat effect)
    if (particles) {
        particles.rotation.y += 0.002;
        // Pulse effect
        const scale = 1 + Math.sin(time * 2) * 0.05;
        particles.scale.set(scale, scale, scale);
    }

    // Animate text (bobbing)
    if (namePlane) {
        namePlane.position.y = Math.sin(time) * 0.2;
    }

    // Update Fireworks
    fireworks.forEach(fw => fw.update());
    fireworks = fireworks.filter(fw => !fw.isDead);

    // Hand Tracking Logic
    if (handLandmarker && video && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, lastVideoTime);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Thumb tip (4) and Index finger tip (8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            // Calculate distance in 2D space (ignoring Z for simplicity of gesture)
            const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );

            // Map distance to Zoom
            // Distance is usually between 0.05 (closed) and 0.5 (open)
            // We want closed -> Zoom In (smaller Z), Open -> Zoom Out (larger Z)
            // OR Pinch -> Zoom In?
            // Let's do: Larger distance (open hand/pinch out) -> Zoom OUT (camera far)
            // Small distance (pinch in) -> Zoom IN (camera close)
            
            // Normalize distance roughly 0 to 0.3
            const targetZ = MIN_CAMERA_Z + (distance * 3) * (MAX_CAMERA_Z - MIN_CAMERA_Z);
            
            // Smoothly interpolate current zoom
            currentZoom += (targetZ - currentZoom) * ZOOM_SENSITIVITY;
            
            // Clamp
            currentZoom = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, currentZoom));
            
            camera.position.z = currentZoom;

            // Trigger Fireworks on Pinch
            // We check if distance is small (pinch) and we haven't fired recently
            if (distance < 0.1 && Date.now() - lastPinchTime > 200) {
                lastPinchTime = Date.now();
                // Spawn firework at random position near the heart
                const fx = (Math.random() - 0.5) * 10;
                const fy = (Math.random() - 0.5) * 10;
                const fz = (Math.random() - 0.5) * 5;
                fireworks.push(new Firework(scene, fx, fy, fz));
            }

            // Pan Left/Right Logic
            // Use the wrist (landmark 0) or average of palm for stable tracking
            const handX = landmarks[0].x; // 0 to 1
            
            // Map 0..1 to -MAX_PAN_X..MAX_PAN_X
            // Note: landmarks.x is normalized image coordinates.
            // 0 is left, 1 is right.
            // We want to map this to camera position.
            // If hand is at 0 (left), camera should maybe go left (negative X)? 
            // Or if we want to "pull" the content, moving hand left moves camera right?
            // Let's try: Hand Right -> Camera Right (moves view to right)
            // But wait, if camera moves right, objects move left. 
            // Let's stick to a direct mapping: Hand Center = Camera Center (0)
            
            // Reversing the mapping because webcam acts like a mirror typically
            // 0.5 is center. 
            // If handX is 0 (left side of image), (0.5 - 0) = 0.5 -> Positive X
            // If handX is 1 (right side of image), (0.5 - 1) = -0.5 -> Negative X
            const targetX = (0.5 - handX) * MAX_PAN_X * 4; // Multiplier for range
            
            currentPanX += (targetX - currentPanX) * PAN_SENSITIVITY;
            camera.position.x = currentPanX;
        }
    }

    renderer.render(scene, camera);
}

// Start
init();

