import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ParametricGeometries } from "three/examples/jsm/geometries/ParametricGeometries.js";
import { ShaderPass }     from "three/examples/jsm/postprocessing/ShaderPass.js";
import { TexturePass }    from "three/examples/jsm/postprocessing/TexturePass.js";
import { ClearPass }      from "three/examples/jsm/postprocessing/ClearPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import * as dat from "dat.gui";

// setup three.js

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth/window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({antialias: false});
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
uniform sampler2D preCamoDepth;
uniform float displacementScale;
uniform float blend;

void main(void) {
    vec2 projection = vNormalVS.xy;
    vec2 displacement = displacementScale / vDistToCameraPlane * -1.0 * projection;
    vec2 v = 0.5*(vNDC + vec2(1.0));
    vec4 normalColor = vec4(vec3(0.5) + vNormalMS*0.5, 1.0);
    float depth = gl_FragCoord.z;
    if (texture2D(preCamoDepth, v+displacement).x < depth) { 
     // gl_FragDepth = 0.0; 
     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
     // discard;
     gl_FragColor = mix(texture2D(preCamo, v), normalColor, blend);
    } else {
    gl_FragColor = mix(texture2D(preCamo, v+displacement), normalColor, blend);
    // gl_FragColor = vec4(texture2D(preCamoDepth, v), 1.0);
    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); 
    }
}
`;



const preCamoTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
preCamoTarget.depthTexture = new THREE.DepthTexture(window.innerWidth, window.innerHeight);
preCamoTarget.depthTexture.minFilter = THREE.NearestFilter;
const camoMaterial = new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: fs,
    uniforms: {
	displacementScale: { value: .1 },
	blend: { value: 0 },
	preCamo: { value: preCamoTarget.texture },
	preCamoDepth: { value: preCamoTarget.depthTexture },
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

const smoothFragmentShader = `
uniform sampler2D tDiffuse;

void main() {
 int s = 5;
 vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);
 for (int i = -s; i <= s; i++) {
  for (int j = -s; j <= s; j++) {
   sum += texture2D(tDiffuse, gl_FragCoord.xy + vec2(i, j));
  }
 }
 gl_FragColor = sum / 9.0;
 // gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
}
`

const composerRt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const composer = new EffectComposer(renderer, composerRt);
composer.renderToScreen = false;
composer.addPass(new ClearPass());
composer.addPass(new TexturePass(preCamoTarget.texture));
composer.addPass(new ShaderPass(
    {fragmentShader: smoothFragmentShader}
));
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

const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const square = new THREE.Mesh(
    new THREE.PlaneGeometry(.5, .5),
    new THREE.MeshBasicMaterial({map: composerRt.texture})
)
const orthoScene = new THREE.Scene();
// orthoScene.add(square);
// square.position.x = -0.875;
// square.position.y = 0.875;
renderer.autoClear = false;

// console.log(composer.);

const controls = new OrbitControls(camera, renderer.domElement);
function animate(t) {
    requestAnimationFrame( animate );
    controls.update();

    

    state_machine.t = t;
    const state = state_machine.state;
    state_machine[state](t);

    camera.layers.disable(1);
    renderer.setRenderTarget(preCamoTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    composer.render();

    camera.layers.enable(1);
    for (let i = 0; i < hasCamo.length; i++) {
	hasCamo[i].rotation.x += .01;
	hasCamo[i].rotation.y += .02;
    }

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(orthoScene, orthoCamera);
}

animate();
