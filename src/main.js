import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ParametricGeometries } from "three/examples/jsm/geometries/ParametricGeometries.js";
import * as dat from "dat.gui";

// setup three.js

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth/window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(new THREE.Color(.1, .1, .1));
document.getElementById("container").appendChild(renderer.domElement);
camera.position.z = 10;

// setup grid

const apothem = 20;
const grid = new THREE.Group();
const planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
const planeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide});
for (let i = 0; i < apothem*2+1; i++) {
    let p1 = new THREE.Mesh(planeGeometry, planeMaterial);
    let p2 = new THREE.Mesh(planeGeometry, planeMaterial);
    grid.add(p1);
    grid.add(p2);
    p1.position.x = i-apothem;
    p1.scale.x = .1;
    p1.scale.y = apothem*2;
    
    p2.position.y = i-apothem;
    p2.scale.y = .1;
    p2.scale.x = apothem*2;
}
scene.add(grid);
grid.position.z = -3;

// setup camo material
const vs = `
varying vec3 vNormalVS;
varying vec3 vNormalMS;
varying vec2 vNDC;
varying float vDistToCameraPlane;

void main(void) {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
    vNDC = gl_Position.xy/gl_Position.w;
    vNormalVS = normalMatrix * normal;
    vNormalMS = normal;
    vDistToCameraPlane = abs((modelViewMatrix * vec4(position, 1.0)).z);
}
`

const fs = `
varying vec3 vNormalVS; 
varying vec3 vNormalMS;
varying vec2 vNDC;
varying float vDistToCameraPlane;

uniform sampler2D preCamo;
uniform float thickness;
uniform float opacity;

void main(void) {
    vec2 refraction = (thickness / vDistToCameraPlane * -1.0 * vNormalVS).xy;
    vec2 v = 0.5*(vNDC + vec2(1.0));
    vec4 normalColor = vec4(vec3(0.5) + vNormalMS*0.5, 1.0);
    gl_FragColor = mix(texture2D(preCamo, v+refraction), normalColor, opacity);
}
`;

const preCamoTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const camoMaterial = new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: fs,
    uniforms: {
	thickness: { value: .1 },
	opacity: { value: 0 },
	preCamo: { value: preCamoTarget.texture },
    }
});

let hasCamo = [];
function addCamoObjectToScene(obj) {
    hasCamo.push(obj);
    // camo objects are on layer 1
    obj.layers.enable(1);
    obj.layers.disable(0);
    scene.add(obj);
}

// add objects

const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.3, 128, 128, 2, 3),
    camoMaterial,
);
addCamoObjectToScene(knot);
const icosa = new THREE.Mesh(
    new THREE.IcosahedronGeometry(),
    camoMaterial,
);
addCamoObjectToScene(icosa)
icosa.position.x = 7;
const mobius = new THREE.Mesh(
    new THREE.ParametricGeometry( ParametricGeometries.mobius3d, 25, 25),
    camoMaterial,
);
addCamoObjectToScene(mobius);
mobius.position.x = -7;

// setup camo animation

const duration = .5;
const blendTrack = new THREE.NumberKeyframeTrack(".value", [0, duration], [0, 1]);
const blendClip = new THREE.AnimationClip("blend", duration, [blendTrack]);
const mixer = new THREE.AnimationMixer(camoMaterial.uniforms.opacity);
const blendAction = mixer.clipAction(blendClip);
blendAction.setLoop(THREE.LoopOnce);
blendAction.timeScale = -1;
blendAction.clampWhenFinished = true;
const clock = new THREE.Clock();

// setup gui

let gui = new dat.GUI();
let config = {
    toggleCamo: function () {
	blendAction.timeScale *= -1;
	blendAction.paused = false;
	blendAction.play();
    },
    resetCamera: function() {
	controls.reset();
    }
};
gui.add(config, "toggleCamo").name("toggle camo");
gui.add(config, "resetCamera").name("reset camera");
gui.add(camoMaterial.uniforms.opacity, "value", 0, 1, .01).name("opacity").listen();
gui.add(camoMaterial.uniforms.thickness, "value", 0, .3, .005).name("thickness");

// add resize event

window.addEventListener("resize", function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    preCamoTarget.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// loop

const controls = new OrbitControls(camera, renderer.domElement);
function animate(t) {
    requestAnimationFrame(animate);

    // update poses
    mixer.update(clock.getDelta());
    hasCamo.forEach((camoObj) => {
	camoObj.rotation.x += .01;
	camoObj.rotation.y += .02;
    });

    // draw no camo objects
    camera.layers.disable(1);
    renderer.setRenderTarget(preCamoTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // draw with camo objects
    camera.layers.enable(1);
    renderer.render(scene, camera);
}

animate();
