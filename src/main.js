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
camera.position.z = 5;

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
console.log(scene.children);

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
uniform float displacementScale;
uniform float blend;

void main(void) {
    vec2 projection = vNormalVS.xy;
    vec2 displacement = displacementScale / vDistToCameraPlane * -1.0 * projection;
    vec2 v = 0.5*(vNDC + vec2(1.0));
    vec4 normalColor = vec4(vec3(0.5) + vNormalMS*0.5, 1.0);
    gl_FragColor = mix(texture2D(preCamo, v+displacement), normalColor, blend);
}
`;

const preCamoTarget = new THREE.WebGLRenderTarget(1080, 720);
const camoMaterial = new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: fs,
    uniforms: {
	displacementScale: { value: .1 },
	blend: { value: 0 },
	preCamo: { value: preCamoTarget.texture },
    }
});

// camo objects are on layer 1
let hasCamo = [];
function addCamoObjectToScene(obj) {
    hasCamo.push(obj);
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

// loop

const state_machine = {
    state: "camoOn",
    t: null,
    transition_start: null,
    transition_length: 500,
    camoOn: function() {},
    camoOff: function() {},
    camoOnTransition: function() {
	const s = this.transition_start;
	let p = (this.t-s)/(this.transition_length);
	if (p >= 1) {
	    this.state = "camoOn";
	    p = 1;
	}
	camoMaterial.uniforms.blend.value = 1-p;
    },
    camoOffTransition: function() {
	const s = this.transition_start;
	let p = (this.t-s)/(this.transition_length);
	if (p >= 1) {
	    this.state = "camoOff";
	    p = 1;
	}
	camoMaterial.uniforms.blend.value = p;
    },
    toggleCamo: function() {
	if (this.state == "camoOn" ||
	    this.state == "camoOnTransition") {
	    this.state = "camoOffTransition";
	    this.transition_start = this.t;
	} else if (this.state == "camoOff" ||
		   this.state == "camoOffTransition") {
	    this.state = "camoOnTransition";
	    this.transition_start = this.t;
	} else {
	    console.log("invalid state");
	}
    },
}

// setup gui

let gui = new dat.GUI();
let config = {};
gui.add(state_machine, "toggleCamo");

const controls = new OrbitControls(camera, renderer.domElement);
function animate(t) {
    requestAnimationFrame( animate );
    controls.update();

    state_machine.t = t;
    const state = state_machine.state;
    state_machine[state](t);

    camera.layers.disable(1);
    renderer.setRenderTarget(preCamoTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    camera.layers.enable(1);
    for (let i = 0; i < hasCamo.length; i++) {
	hasCamo[i].rotation.x += .01;
	hasCamo[i].rotation.y += .02;
    }

    renderer.render(scene, camera);
}

animate();
