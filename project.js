import { defs, tiny } from './examples/common.js';
import { dropper } from './dropper.js';
import constants from './constants.js';
import util from './util.js';

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
            windmill: new defs.Windmill(),
            // TODO:  Fill in as many additional shape instances as needed in this key/value table.
            //        (Requirement 1)s
        };

        this.dynamicMaterials = {
            uniformColor: function (ambient, diffusivity, specularity) {
                const color = util.generateColor();
                const material = new Material(new defs.Phong_Shader(), { ambient: ambient, diffusivity: diffusivity, specularity: specularity, color: hex_color(color) });
                return () => material;
            },
            uniformDullColor: function (ambient, diffusivity, specularity) {
                const rgb = util.hsvToRgb(Math.random(), .6, 1)
                const hex = util.rgbToHex(rgb[0], rgb[1], rgb[2]);
                const colorVec = hex_color(hex);
                const material = new Material(new defs.Phong_Shader(), { ambient: ambient, diffusivity: diffusivity, specularity: specularity, color: colorVec });
                return () => material;
            },

        }

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                { ambient: .2, diffusivity: .6, specularity: .4, color: hex_color("#ffffff") }),
            // test2: new Material(new Gouraud_Shader(),
            //     {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            // ring: new Material(new Ring_Shader()),
            // TODO:  Fill in as many additional material objects as needed in this key/value table.
            //        (Requirement 4)

        }

        this.score = 0;
        this.difficulty = .1;
        this.depth = 1000
        this.radius = 1
        this.walls = new dropper.Walls(this.depth, this.shapes.square, this.dynamicMaterials.uniformDullColor(.4, 1, 0))
        // look straight down at negative z, up is y, right is x
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 1), vec3(0, 0, 0), vec3(0, 1, 0));
        this.spawn_pos = -300
        this.initial_velocity = 0
        this.platforms = [new dropper.UniformScatterPlatform(this.spawn_pos, this.shapes.square,
            this.difficulty, this.dynamicMaterials.uniformColor(.4, .6, .2))]
        this.thrust = vec4(0, 0, 0, 0)
        this.displacement = 5
        this.box_pos = Mat4.translation(0, 0, -30)
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Up", ["w"], () => this.thrust[1] = this.displacement, undefined, () => this.thrust[1] = 0);
        this.new_line();
        this.key_triggered_button("Left", ["a"], () => this.thrust[0] = -this.displacement, undefined, () => this.thrust[0] = 0);
        this.key_triggered_button("Down", ["s"], () => this.thrust[1] = -this.displacement, undefined, () => this.thrust[1] = 0);
        this.key_triggered_button("Right", ["d"], () => this.thrust[0] = this.displacement, undefined, () => this.thrust[0] = 0);
        this.new_line();
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            //this.children.push(context.scratchpad.controls = new dropper.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            context.scratchpad.controls = 1
            program_state.set_camera(this.initial_camera_location);
            //this.displacement = program_state.animation_delta_time / 1000

        }
        else {
            //let collision = this.walls.check_sphere_collision(context.scratchpad.controls.pos, this.radius)
            //context.scratchpad.controls.update_thrust(collision)
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);


        // TODO:  Fill in matrix operations and drawing code to draw the solar system scene (Requirements 3 and 4)
        const t = program_state.animation_time / 1000,
            dt = program_state.animation_delta_time / 1000;
        let adjust_box = Mat4.identity();

        if (this.thrust[0] || this.thrust[1])
            this.box_pos = this.box_pos.times(Mat4.translation(this.thrust[0] * dt, this.thrust[1] * dt, 0))

        let center = this.box_pos.times(vec4(0, 0, 0, 1))
        if (center[0] + this.radius > constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(constants.WALL_SIDE_LENGTH - center[0] - this.radius, 0, 0))
        if (center[0] - this.radius < -constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(-constants.WALL_SIDE_LENGTH - center[0] + this.radius, 0, 0))
        if (center[1] + this.radius > constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(0, constants.WALL_SIDE_LENGTH - center[1] - this.radius, 0))
        if (center[1] - this.radius < -constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(0, -constants.WALL_SIDE_LENGTH - center[1] + this.radius, 0))

        this.box_pos = this.box_pos.times(adjust_box)
        //Physics
        const g = 9.81
        let z_velocity = 0.5 * g * (t ** 2)
        z_velocity = Math.min(z_velocity, 100)

        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 0, 5, 1);
        const second_light_position = vec4(0, 0, 20, 1)
        // The parameters of the Light are: position, color, size
        const yellow = hex_color("#fac91a");
        const white = hex_color("#ffffff");
        program_state.lights = [new Light(second_light_position, white, 1000000)];


        //let wall_transform_x = model_transform.times(Mat4.scale(1, 10, 10))
        //let wall_transform_y = base_transform.times(Mat4.rotation(Math.PI/2, 0, 1, 0))
        this.shapes.square.draw(context, program_state, this.box_pos, this.materials.test)


        this.platforms = this.platforms.filter(x => x.position < 10)

        if (this.platforms.length === 0) {
            this.score++;
            this.difficulty += .0020;
            if (this.difficulty >= .8) this.difficulty = .5;
            this.platforms.push(new dropper.UniformScatterPlatform(this.spawn_pos, this.shapes.square, this.difficulty,
                this.dynamicMaterials.uniformColor(.4, .6, .2)))
        }

        for (let i = 0; i < this.platforms.length; ++i) {
            const platform = this.platforms[i];
            for (let j = 0; j < platform.shapePackages.length; ++j) {
                const shapePackage = platform.shapePackages[j];

                let object_start = Mat4.translation(shapePackage.xTranslation, shapePackage.yTranslation, platform.position + z_velocity * dt + shapePackage.zTranslation)
                if (platform.material() == null)
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, this.materials.test)
                else
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, platform.material())
            }
            platform.position += z_velocity * dt
        }

        for (let i = 0; i < this.walls.wall_transforms.length; ++i)
            this.walls.shape.draw(context, program_state, this.walls.wall_transforms[i], this.walls.material())
    }
}

