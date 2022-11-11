import { tiny } from '../tiny-graphics.js';
import { widgets } from '../tiny-graphics-widgets.js';
import constants from './constants.js';
// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4,
    Light, Shape, Material, Shader, Texture, Scene
} = tiny;


Object.assign(tiny, widgets);

const dropper = {};

export { tiny, dropper };

const Walls = dropper.Walls =
    class Walls {
        constructor(depth, shape, material) {
            this.side = constants.WALL_SIDE_LENGTH,
                this.depth = depth
            this.shape = shape
            this.material = material
            const top_bot_scale = Mat4.scale(this.side, 1, depth)
            const left_right_scale = Mat4.scale(1, this.side, depth)
            const wall_transform_north = Mat4.translation(0, this.side + 1, -depth - 1).times(top_bot_scale)
            const wall_transform_south = Mat4.translation(0, -this.side - 1, -depth - 1).times(top_bot_scale)
            const wall_transform_west = Mat4.translation(-this.side - 1, 0, -depth - 1).times(left_right_scale)
            const wall_transform_east = Mat4.translation(this.side + 1, 0, -depth - 1).times(left_right_scale)
            this.wall_transforms = [wall_transform_north, wall_transform_east, wall_transform_south, wall_transform_west]
        }

        check_sphere_collision(center, radius) {
            if (center[0] + radius > this.side)
                return vec3(-center[0] - radius + this.side, 0, 0)
            if (center[0] - radius < -this.side)
                return vec(-center[0] + radius - this.side, 0, 0)
            if (center[1] + radius > this.side)
                return vec3(0, -center[1] - radius + this.side, 0)
            if (center[1] - radius < -this.side)
                return vec(0, -center[1] + radius - this.side, 0)
            return vec(0, 0, 0)
        }
    }

const ShapeDrawPackage = dropper.ShapeDrawPackage =
    class ShapeDrawPackage {
        /**
         * 
         * @param {*} shapeIndex 
         * @param {*} xTranslation 
         * @param {*} yTranslation 
         * @param {*} zTranslation 
         * @param {*} zRotation 
         * @param {*} material THIS IS A FUNCTION, this is so that we dont duplicate a shit load of memory
         */
        constructor(shapeIndex, xTranslation = 0, yTranslation = 0, zTranslation = 0, zRotation = 0) {
            this.shapeIndex = shapeIndex;
            this.xTranslation = xTranslation;
            this.yTranslation = yTranslation;
            this.zTranslation = zTranslation;
            this.zRotation = zRotation;
        }
    }

const Platform = dropper.Platform =
    class Platform {
        constructor(start_Pos, shapes) {
            this.shapes = shapes;
            this.position = start_Pos;
            this.shapePackages = [];
        }
        generate() { throw Error("this should be overridden") }
    }

const UniformScatterPlatform = dropper.UniformScatterPlatform =
    class UniformScatterPlatform extends Platform {
        /**
         * 
         * @param {*} start_Pos 
         * @param {*} unitShapes 
         * @param {*} depth - how far the platform goes on z axis
         * @param {*} fill - float between 0 and 1, determines density of platform
         */
        constructor(start_Pos, shape, fill, material = () => null, depth = 1) {
            super(start_Pos, Array(shape))
            // create shapePackages
            this.material = material;
            this.generateShapePackages(depth, fill);
        }
        generateShapePackages(depth, fill) {
            // calculate inner wall length and height
            const length = constants.WALL_SIDE_LENGTH * 2;
            const shapePackages = [];

            let numOfBlocks = 0;
            for (let z = 0; z < depth; z++) {
                // goes for certian depth
                for (let x = 0; x < length; x++) {
                    // go row by row
                    for (let y = 0; y < length; y++) {
                        // run random
                        // has to meet threshold
                        if (Math.random() <= fill) {
                            numOfBlocks++;
                            // create shape packages
                            shapePackages.push(new ShapeDrawPackage(0, x - length / 2, y - length / 2, z, 0));
                        }
                    }
                }
            }
            this.shapePackages = shapePackages;
        }
    }

const Movement_Controls = dropper.Movement_Controls =
    class Movement_Controls extends Scene {
        // **Movement_Controls** is a Scene that can be attached to a canvas, like any other
        // Scene, but it is a Secondary Scene Component -- meant to stack alongside other
        // scenes.  Rather than drawing anything it embeds both first-person and third-
        // person style controls into the website.  These can be used to manually move your
        // camera or other objects smoothly through your scene using key, mouse, and HTML
        // button controls to help you explore what's in it.
        constructor() {
            super();
            const data_members = {
                roll: 0, look_around_locked: true,
                thrust: vec3(0, 0, 0), pos: vec3(0, 0, 0), z_axis: vec3(0, 0, 0),
                radians_per_frame: 1 / 200, meters_per_frame: 20, speed_multiplier: 1
            };
            Object.assign(this, data_members);

            // this.mouse_enabled_canvases = new Set();
            this.will_take_over_graphics_state = true;
            this.last_wall_collision = ""
            this.position_update = vec3(0, 0, 0)
        }

        set_recipient(matrix_closure, inverse_closure) {
            // set_recipient(): The camera matrix is not actually stored here inside Movement_Controls;
            // instead, track an external target matrix to modify.  Targets must be pointer references
            // made using closures.
            this.matrix = matrix_closure;
            this.inverse = inverse_closure;
        }

        reset(graphics_state) {
            // reset(): Initially, the default target is the camera matrix that Shaders use, stored in the
            // encountered program_state object.  Targets must be pointer references made using closures.
            this.set_recipient(() => graphics_state.camera_transform,
                () => graphics_state.camera_inverse);
        }

        // add_mouse_controls(canvas) {
        //     // add_mouse_controls():  Attach HTML mouse events to the drawing canvas.
        //     // First, measure mouse steering, for rotating the flyaround camera:
        //     this.mouse = {"from_center": vec(0, 0)};
        //     const mouse_position = (e, rect = canvas.getBoundingClientRect()) =>
        //         vec(e.clientX - (rect.left + rect.right) / 2, e.clientY - (rect.bottom + rect.top) / 2);
        //     // Set up mouse response.  The last one stops us from reacting if the mouse leaves the canvas:
        //     document.addEventListener("mouseup", e => {
        //         this.mouse.anchor = undefined;
        //     });
        //     canvas.addEventListener("mousedown", e => {
        //         e.preventDefault();
        //         this.mouse.anchor = mouse_position(e);
        //     });
        //     canvas.addEventListener("mousemove", e => {
        //         e.preventDefault();
        //         this.mouse.from_center = mouse_position(e);
        //     });
        //     canvas.addEventListener("mouseout", e => {
        //         if (!this.mouse.anchor) this.mouse.from_center.scale_by(0)
        //     });
        // }

        show_explanation(document_element) {
        }

        make_control_panel() {
            // make_control_panel(): Sets up a panel of interactive HTML elements, including
            // buttons with key bindings for affecting this scene, and live info readouts.
            this.control_panel.innerHTML += "Click and drag the scene to spin your viewpoint around it.<br>";
            this.live_string(box => box.textContent = "- Position: " + this.pos[0].toFixed(2) + ", " + this.pos[1].toFixed(2)
                + ", " + this.pos[2].toFixed(2));
            this.new_line();
            // The facing directions are surprisingly affected by the left hand rule:
            this.live_string(box => box.textContent = "- Facing: " + ((this.z_axis[0] > 0 ? "West " : "East ")
                + (this.z_axis[1] > 0 ? "Down " : "Up ") + (this.z_axis[2] > 0 ? "North" : "South")));
            this.new_line();
            this.new_line();

            this.key_triggered_button("Up", ["w"], () => this.thrust[1] = -1, undefined, () => this.thrust[1] = 0);
            this.key_triggered_button("Forward", ["z"], () => this.thrust[2] = 1, undefined, () => this.thrust[2] = 0);
            this.new_line();
            this.key_triggered_button("Left", ["a"], () => this.thrust[0] = 1, undefined, () => this.thrust[0] = 0);
            this.key_triggered_button("Back", [" "], () => this.thrust[2] = -1, undefined, () => this.thrust[2] = 0);
            this.key_triggered_button("Right", ["d"], () => this.thrust[0] = -1, undefined, () => this.thrust[0] = 0);
            this.new_line();
            this.key_triggered_button("Down", ["s"], () => this.thrust[1] = 1, undefined, () => this.thrust[1] = 0);

            const speed_controls = this.control_panel.appendChild(document.createElement("span"));
            speed_controls.style.margin = "30px";
            this.key_triggered_button("-", ["o"], () =>
                this.speed_multiplier /= 1.2, undefined, undefined, undefined, speed_controls);
            this.live_string(box => {
                box.textContent = "Speed: " + this.speed_multiplier.toFixed(2)
            }, speed_controls);
            this.key_triggered_button("+", ["p"], () =>
                this.speed_multiplier *= 1.2, undefined, undefined, undefined, speed_controls);
            this.new_line();
            this.key_triggered_button("Roll left", [","], () => this.roll = 1, undefined, () => this.roll = 0);
            this.key_triggered_button("Roll right", ["."], () => this.roll = -1, undefined, () => this.roll = 0);
            this.new_line();
            // this.key_triggered_button("(Un)freeze mouse look around", ["f"], () => this.look_around_locked ^= 1, "#8B8885");
            // this.new_line();
            // this.key_triggered_button("Go to world origin", ["r"], () => {
            //     this.matrix().set_identity(4, 4);
            //     this.inverse().set_identity(4, 4)
            // }, "#8B8885");
            // this.new_line();

            // this.key_triggered_button("Look at origin from front", ["1"], () => {
            //     this.inverse().set(Mat4.look_at(vec3(0, 0, 10), vec3(0, 0, 0), vec3(0, 1, 0)));
            //     this.matrix().set(Mat4.inverse(this.inverse()));
            // }, "#8B8885");
            // this.new_line();
            // this.key_triggered_button("from right", ["2"], () => {
            //     this.inverse().set(Mat4.look_at(vec3(10, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0)));
            //     this.matrix().set(Mat4.inverse(this.inverse()));
            // }, "#8B8885");
            // this.key_triggered_button("from rear", ["3"], () => {
            //     this.inverse().set(Mat4.look_at(vec3(0, 0, -10), vec3(0, 0, 0), vec3(0, 1, 0)));
            //     this.matrix().set(Mat4.inverse(this.inverse()));
            // }, "#8B8885");
            // this.key_triggered_button("from left", ["4"], () => {
            //     this.inverse().set(Mat4.look_at(vec3(-10, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0)));
            //     this.matrix().set(Mat4.inverse(this.inverse()));
            // }, "#8B8885");
            // this.new_line();
            // this.key_triggered_button("Attach to global camera", ["Shift", "R"],
            //     () => {
            //         this.will_take_over_graphics_state = true
            //     }, "#8B8885");
            // this.new_line();
        }

        first_person_flyaround(radians_per_frame, meters_per_frame, leeway = 70) {
            // (Internal helper function)
            // Compare mouse's location to all four corners of a dead box:
            // const offsets_from_dead_box = {
            //     plus: [this.mouse.from_center[0] + leeway, this.mouse.from_center[1] + leeway],
            //     minus: [this.mouse.from_center[0] - leeway, this.mouse.from_center[1] - leeway]
            // };
            // // Apply a camera rotation movement, but only when the mouse is
            // // past a minimum distance (leeway) from the canvas's center:
            // if (!this.look_around_locked)
            //     // If steering, steer according to "mouse_from_center" vector, but don't
            //     // start increasing until outside a leeway window from the center.
            //     for (let i = 0; i < 2; i++) {                                     // The &&'s in the next line might zero the vectors out:
            //         let o = offsets_from_dead_box,
            //             velocity = ((o.minus[i] > 0 && o.minus[i]) || (o.plus[i] < 0 && o.plus[i])) * radians_per_frame;
            //         // On X step, rotate around Y axis, and vice versa.
            //         this.matrix().post_multiply(Mat4.rotation(-velocity, i, 1 - i, 0));
            //         this.inverse().pre_multiply(Mat4.rotation(+velocity, i, 1 - i, 0));
            // }
            this.matrix().post_multiply(Mat4.rotation(-.1 * this.roll, 0, 0, 1));
            this.inverse().pre_multiply(Mat4.rotation(+.1 * this.roll, 0, 0, 1));
            // Now apply translation movement of the camera, in the newest local coordinate frame.
            this.matrix().post_multiply(Mat4.translation(...this.thrust.times(-meters_per_frame)));
            this.inverse().pre_multiply(Mat4.translation(...this.thrust.times(+meters_per_frame)));
        }

        third_person_arcball(radians_per_frame) {
            // (Internal helper function)
            // Spin the scene around a point on an axis determined by user mouse drag:
            const dragging_vector = this.mouse.from_center.minus(this.mouse.anchor);
            if (dragging_vector.norm() <= 0)
                return;
            this.matrix().post_multiply(Mat4.translation(0, 0, -25));
            this.inverse().pre_multiply(Mat4.translation(0, 0, +25));

            const rotation = Mat4.rotation(radians_per_frame * dragging_vector.norm(),
                dragging_vector[1], dragging_vector[0], 0);
            this.matrix().post_multiply(rotation);
            this.inverse().pre_multiply(rotation);

            this.matrix().post_multiply(Mat4.translation(0, 0, +25));
            this.inverse().pre_multiply(Mat4.translation(0, 0, -25));
        }

        display(context, graphics_state, dt = graphics_state.animation_delta_time / 1000) {
            // The whole process of acting upon controls begins here.
            const m = this.speed_multiplier * this.meters_per_frame,
                r = this.speed_multiplier * this.radians_per_frame;

            if (this.will_take_over_graphics_state) {
                this.reset(graphics_state);
                this.will_take_over_graphics_state = false;
            }

            // if (!this.mouse_enabled_canvases.has(context.canvas)) {
            //     this.add_mouse_controls(context.canvas);
            //     this.mouse_enabled_canvases.add(context.canvas)
            // }
            this.absolute_thrust = this.inverse().times(vec4(this.thrust[0], this.thrust[1], this.thrust[2], 0))
            // Move in first-person.  Scale the normal camera aiming speed by dt for smoothness:
            if (this.position_update[0] || this.position_update[1]) {
                let mag = Math.sqrt(this.position_update.dot(this.position_update))
                let a = this.position_update.dot(this.absolute_thrust) / mag
                let b = this.position_update.times(1 / mag).times(a)
                let c = this.absolute_thrust.minus(b)
                this.absolute_thrust = vec4(c[0], c[1], c[2], 0)
                this.thrust = this.matrix().times(this.absolute_thrust).to3()
            }

            this.first_person_flyaround(dt * r, dt * m);
            // Also apply third-person "arcball" camera mode if a mouse drag is occurring:
            // if (this.mouse.anchor)
            //     this.third_person_arcball(dt * r);
            // Log some values:
            this.pos = this.inverse().times(vec4(0, 0, 0, 1));
            this.z_axis = this.inverse().times(vec4(0, 0, 1, 0));
        }

        update_thrust(vec) {
            this.position_update[0] = vec[0]
            this.position_update[1] = vec[1]
            this.position_update[2] = vec[2]
        }
    }   
