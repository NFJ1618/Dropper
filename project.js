import {defs, tiny} from './examples/common.js';
import { dropper } from './dropper.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            square: new defs.Cube(),
            // TODO:  Fill in as many additional shape instances as needed in this key/value table.
            //        (Requirement 1)s
        };

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            // test2: new Material(new Gouraud_Shader(),
            //     {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            // ring: new Material(new Ring_Shader()),
            // TODO:  Fill in as many additional material objects as needed in this key/value table.
            //        (Requirement 4)

        }
        // look straight down at negative z, up is y, right is x
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 1), vec3(0, 0, 0), vec3(0, 1, 0));
        this.spawn_pos = -300
        this.initial_velocity = 0
        this.platforms = [new dropper.Platform(this.spawn_pos, this.shapes.square)]

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("View solar system", ["Control", "0"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Attach to planet 1", ["Control", "1"], () => this.attached = () => this.planet_1);
        this.key_triggered_button("Attach to planet 2", ["Control", "2"], () => this.attached = () => this.planet_2);
        this.new_line();
        this.key_triggered_button("Attach to planet 3", ["Control", "3"], () => this.attached = () => this.planet_3);
        this.key_triggered_button("Attach to planet 4", ["Control", "4"], () => this.attached = () => this.planet_4);
        this.new_line();
        this.key_triggered_button("Attach to moon", ["Control", "m"], () => this.attached = () => this.moon);
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new dropper.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);


        // TODO:  Fill in matrix operations and drawing code to draw the solar system scene (Requirements 3 and 4)
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        const yellow = hex_color("#fac91a");
        let model_transform = Mat4.identity();

        //Physics
        const g = 9.81
        let z_velocity = 0.5 * g * (t**2)
        z_velocity = Math.min(z_velocity, 100)
       
        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 0, 5, 1);
        const second_light_position = vec4(0, 0, 10, 1)
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, yellow, 1000000)];
        const depth = 1000
        const side = 10
        let top_bot_scale = Mat4.scale(side, 1, depth)
        let left_right_scale = Mat4.scale(1, side, depth)
        
        //let wall_transform_x = model_transform.times(Mat4.scale(1, 10, 10))
        //let wall_transform_y = base_transform.times(Mat4.rotation(Math.PI/2, 0, 1, 0))
        let wall_transform_north = Mat4.translation(0, side+1, -depth-1).times(top_bot_scale)
        let wall_transform_south = Mat4.translation(0, -side-1, -depth-1).times(top_bot_scale)
        let wall_transform_west = Mat4.translation(-side-1, 0, -depth-1).times(left_right_scale)
        let wall_transform_east = Mat4.translation(side+1, 0, -depth-1).times(left_right_scale)

        this.platforms = this.platforms.filter(x => x.position < 10)

        if (this.platforms.length === 0)
            this.platforms.push(new dropper.Platform(this.spawn_pos, this.shapes.square))
        
        for (let i = 0; i < this.platforms.length; ++i) {
            for (let j = 0; j < this.platforms[i].shapes.length; ++j) {
                let object_start = Mat4.translation(0, 0, this.platforms[i].position+z_velocity*dt)
                this.platforms[i].shapes[j].draw(context, program_state, object_start, this.materials.test)
            }
            this.platforms[i].position += z_velocity*dt
        }
        
        this.shapes.square.draw(context, program_state, wall_transform_north, this.materials.test.override({color: yellow}));
        this.shapes.square.draw(context, program_state, wall_transform_south, this.materials.test.override({color: yellow}));
        this.shapes.square.draw(context, program_state, wall_transform_east, this.materials.test.override({color: yellow}));
        this.shapes.square.draw(context, program_state, wall_transform_west, this.materials.test.override({color: yellow}));
    }
}

