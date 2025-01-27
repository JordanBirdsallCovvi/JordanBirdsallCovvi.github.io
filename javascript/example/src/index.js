/* globals */
import * as THREE from 'three';
import { registerDragEvents } from './dragAndDrop.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import URDFManipulator from '../../src/urdf-manipulator-element.js';

customElements.define('urdf-viewer', URDFManipulator);

// declare these globally for the sake of the example.
// Hack to make the build work with webpack for now.
// TODO: Remove this once modules or parcel is being used
const viewer = document.querySelector('urdf-viewer');

// const limitsToggle     = document.getElementById('ignore-joint-limits');
// const collisionToggle  = document.getElementById('collision-toggle');
// const radiansToggle    = document.getElementById('radians-toggle');
// const autocenterToggle = document.getElementById('autocenter-toggle');
const upSelect         = document.getElementById('up-select');
const sliderList       = document.querySelector('#controls ul');
const controlsel       = document.getElementById('controls');
// const controlsToggle   = document.getElementById('toggle-controls');
const animToggle       = document.getElementById('do-animate');
// const hideFixedToggle  = document.getElementById('hide-fixed');
const DEG2RAD          = Math.PI / 180;
const RAD2DEG          = 1 / DEG2RAD;
let sliders = {};

var jurdf = 'test';
const joints_to_ignore = new Set(''.split(' '));
const joints_to_drive  = new Set('Thumb Index Middle Ring Little Rotate'.split(' ')).difference(joints_to_ignore);


// Global Functions
const setColor = color => {
    document.body.style.backgroundColor = color;
    viewer.highlightColor = '#' + (new THREE.Color(0xffffff)).lerp(new THREE.Color(color), 0.35).getHexString();
};


// Events
// toggle checkbox
// limitsToggle.addEventListener('click', () => {
//     limitsToggle.classList.toggle('checked');
//     viewer.ignoreLimits = limitsToggle.classList.contains('checked');
// });


// radiansToggle.addEventListener('click', () => {
//     radiansToggle.classList.toggle('checked');
//     Object
//         .values(sliders)
//         .forEach(sl => sl.update());
// });


// collisionToggle.addEventListener('click', () => {
//     collisionToggle.classList.toggle('checked');
//     viewer.showCollision = collisionToggle.classList.contains('checked');
// });


// autocenterToggle.addEventListener('click', () => {
//     autocenterToggle.classList.toggle('checked');
//     viewer.noAutoRecenter = !autocenterToggle.classList.contains('checked');
// });


// hideFixedToggle.addEventListener('click', () => {
//     hideFixedToggle.classList.toggle('checked');

//     const hideFixed = hideFixedToggle.classList.contains('checked');
//     if (hideFixed) controlsel.classList.add('hide-fixed');
//     else controlsel.classList.remove('hide-fixed');

// });


upSelect.addEventListener('change', () => viewer.up = upSelect.value);

// controlsToggle.addEventListener('click', () => controlsel.classList.toggle('hidden'));


// watch for urdf changes
viewer.addEventListener('urdf-change', () => {
    Object
        .values(sliders)
        .forEach(sl => sl.remove());
    sliders = {};
});


viewer.addEventListener('ignore-limits-change', () => {
    Object
        .values(sliders)
        .forEach(sl => sl.update());
});


viewer.addEventListener('angle-change', e => {
    if (sliders[e.detail]) sliders[e.detail].update();
});


viewer.addEventListener('joint-mouseover', e => {
    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) j.setAttribute('robot-hovered', true);
});


viewer.addEventListener('joint-mouseout', e => {
    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) j.removeAttribute('robot-hovered');
});


let originalNoAutoRecenter;
viewer.addEventListener('manipulate-start', e => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) {
        j.scrollIntoView({ block: 'nearest' });
        window.scrollTo(0, 0);
    }

    originalNoAutoRecenter = viewer.noAutoRecenter;
    viewer.noAutoRecenter = true;
});


viewer.addEventListener('manipulate-end', e => {
    viewer.noAutoRecenter = originalNoAutoRecenter;
});


// create the sliders
viewer.addEventListener('urdf-processed', () => {

    const r = viewer.robot;
    Object
        .keys(r.joints)
        // .sort((a, b) => {

        //     const da = a.split(/[^\d]+/g).filter(v => !!v).pop();
        //     const db = b.split(/[^\d]+/g).filter(v => !!v).pop();

        //     if (da !== undefined && db !== undefined) {
        //         const delta = parseFloat(da) - parseFloat(db);
        //         if (delta !== 0) return delta;
        //     }

        //     if (a > b) return 1;
        //     if (b > a) return -1;
        //     return 0;

        // })
        .map(key => r.joints[key])
        .forEach(joint => {

            if (joint.name.startsWith('_')) return;
            if (joint.name in joints_to_ignore) return;

            const li = document.createElement('li');
            li.innerHTML =
            `
            <span title="${ joint.name }">${ joint.name }</span>
            <input type="range" value="0" step="0.0001"/>
            <input type="number" step="0.0001" />
            `;
            li.setAttribute('joint-type', joint.jointType);
            li.setAttribute('joint-name', joint.name);

            sliderList.appendChild(li);

            // update the joint display
            const slider = li.querySelector('input[type="range"]');
            const input = li.querySelector('input[type="number"]');
            li.update = () => {
                // const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : RAD2DEG;
                const degMultiplier = RAD2DEG;
                let angle = joint.angle;

                if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
                    angle *= degMultiplier;
                }

                if (Math.abs(angle) > 1) {
                    angle = angle.toFixed(1);
                } else {
                    angle = angle.toPrecision(2);
                }

                input.value = parseFloat(angle);

                // directly input the value
                slider.value = joint.angle;

                if (viewer.ignoreLimits || joint.jointType === 'continuous') {
                    slider.min = -6.28;
                    slider.max = 6.28;

                    input.min = -6.28 * degMultiplier;
                    input.max = 6.28 * degMultiplier;
                } else {
                    slider.min = joint.limit.lower;
                    slider.max = joint.limit.upper;

                    input.min = joint.limit.lower * degMultiplier;
                    input.max = joint.limit.upper * degMultiplier;
                }
            };

            switch (joint.jointType) {

                case 'continuous':
                case 'prismatic':
                case 'revolute':
                    break;
                default:
                    li.update = () => {};
                    input.remove();
                    slider.remove();

            }

            slider.addEventListener('input', () => {
                viewer.setJointValue(joint.name, slider.value);
                li.update();
            });

            input.addEventListener('change', () => {
                // const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : DEG2RAD;
                const degMultiplier = DEG2RAD;
                viewer.setJointValue(joint.name, input.value * degMultiplier);
                li.update();
            });

            li.update();

            sliders[joint.name] = li;
        });
});


document.addEventListener('WebComponentsReady', () => {

    viewer.loadMeshFunc = (path, manager, done) => {

        const ext = path.split(/\./g).pop().toLowerCase();
        switch (ext) {

            case 'gltf':
            case 'glb':
                new GLTFLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err),
                );
                break;
            case 'obj':
                new OBJLoader(manager).load(
                    path,
                    result => done(result),
                    null,
                    err => done(null, err),
                );
                break;
            case 'dae':
                new ColladaLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err),
                );
                break;
            case 'stl':
                new STLLoader(manager).load(
                    path,
                    result => {
                        const material = new THREE.MeshPhongMaterial();
                        const mesh = new THREE.Mesh(result, material);
                        done(mesh);
                    },
                    null,
                    err => done(null, err),
                );
                break;
        }
    };

    document.querySelector('li[urdf]').dispatchEvent(new Event('click'));

    if (/javascript\/example\/bundle/i.test(window.location)) {
        viewer.package = '../../../urdf';
    }

    registerDragEvents(viewer, () => {
        setColor('#263238');
        animToggle.classList.remove('checked');
        updateURDFList();
    });
});


// init 2D UI and animation
const updateAngles = () => {

    if (!viewer.setJointValue) return;

    // reset everything to 0 first
    const resetJointValues = viewer.angles;
    for (const name in resetJointValues) resetJointValues[name] = 0;
    viewer.setJointValues(resetJointValues);

    // animate the legs
    const time = Date.now() / 3e2;
    for (let i = 1; i <= 6; i++) {

        const offset = i * Math.PI / 3;
        const ratio = Math.max(0, Math.sin(time + offset));

        viewer.setJointValue(`HP${ i }`, THREE.MathUtils.lerp(30, 0, ratio) * DEG2RAD);
        viewer.setJointValue(`KP${ i }`, THREE.MathUtils.lerp(90, 150, ratio) * DEG2RAD);
        viewer.setJointValue(`AP${ i }`, THREE.MathUtils.lerp(-30, -60, ratio) * DEG2RAD);

        viewer.setJointValue(`TC${ i }A`, THREE.MathUtils.lerp(0, 0.065, ratio));
        viewer.setJointValue(`TC${ i }B`, THREE.MathUtils.lerp(0, 0.065, ratio));

        viewer.setJointValue(`W${ i }`, window.performance.now() * 0.001);
    }
};


const updateAngles_test = (driver_joint, start, stop) => {
    const time = Date.now() / 9e2;
    const ratio = (Math.asin(Math.sin(time)) + (Math.PI * 0.5)) / Math.PI;
    const x = THREE.MathUtils.lerp(start, stop, ratio);
    viewer.setJointValue(driver_joint, x);
};


var this_time = Date.now();
var prev_time = Date.now();
var diff_time = 1;
var time = 0;

const updateAngles_covvi_hand = () => {
    time += diff_time / 9e2;
    const ratio = (Math.asin(Math.sin(time)) + (Math.PI * 0.5)) / Math.PI;
    // const x = THREE.MathUtils.lerp(0, 360 / Math.PI, ratio) * DEG2RAD;
    const x = THREE.MathUtils.lerp(0, 180 / Math.PI, ratio) * DEG2RAD;
    joints_to_drive.forEach((element) => viewer.setJointValue(element, x));
};


const updateLoop = () => {
    this_time = Date.now();
    diff_time = this_time - prev_time;

    if (animToggle.classList.contains('checked')) {
        switch (jurdf) {
            case 'covvi_hand_right.urdf':
            case 'covvi_hand_left.urdf':
            case 'linear_covvi_hand_right.urdf':
            case 'linear_covvi_hand_left.urdf':
                updateAngles_covvi_hand();
                break;
            // default:
            //     updateAngles();
            //     break;
        }
    }

    prev_time = this_time;
    requestAnimationFrame(updateLoop);
};


const updateURDFList = () => {

    document.querySelectorAll('#urdf-options li[urdf]').forEach(el => {

        el.addEventListener('click', e => {

            const urdf  = e.target.getAttribute('urdf');
            const color = e.target.getAttribute('color');

            jurdf = urdf.split('/').at(-1);
            document.getElementById('up-select').value = viewer.up;
            viewer.urdf = urdf;
            animToggle.classList.add('checked');
            setColor(color);

        });
    });
};

updateURDFList();

document.addEventListener('WebComponentsReady', () => {

    animToggle.addEventListener('click', () => animToggle.classList.toggle('checked'));

    // stop the animation if user tried to manipulate the model
    // viewer.noAutoRecenter = !autocenterToggle.classList.contains('checked');
    viewer.noAutoRecenter = true;
    viewer.addEventListener('manipulate-start', e => animToggle.classList.remove('checked'));
    viewer.addEventListener('urdf-processed', e => updateAngles());
    updateLoop();
    viewer.camera.position.set(5.591197327504393, 7.211907733472893, -14.098807607601064);
});
