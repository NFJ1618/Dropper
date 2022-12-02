import { defs, tiny } from './examples/common.js';
import { dropper } from './dropper.js';
import constants from './constants.js';
import util from './util.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

function proxy_collision_checker() {
    return Math.random() > 0.99;
}

export class Project extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            wall: new defs.Cube(),
            player: new defs.Cube(),
            square: new defs.Cube(),
            windmill: new defs.Windmill(),
            // TODO:  Fill in as many additional shape instances as needed in this key/value table.
            //        (Requirement 1)s
        };

        // *** Materials
        this.materials = {
            player: new Material(new Dynamic_Texture(), {
                color: hex_color("#ffffff"),
                ambient: 0.5, diffusivity: 0.1, specularity: 0.2,
                texture: new Texture("assets/cracks.png", "NEAREST"),
                scale: 1, dx: 0, dy: 0,
            }),

            wall: new Material(new Textured_Scroll(), {
                color: hex_color("#222222"),
                ambient: 0.2, diffusivity: 0.6, specularity: 0.2,
                texture: new Texture("assets/wall.png", "NEAREST"),
                total_displacement: 0.0,
            }),

            wasted: new Material(new defs.Textured_Phong(), {
                color: hex_color("000000"),
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/wasted.png", "NEAREST"),
            }),

            platform: new Material(new defs.Phong_Shader(), {
                ambient: 0.4, diffusivity: 0.2, specularity: 0.6,
                color: hex_color("#ffffff")
            })
        }
        this.dynamicMaterials = {
            uniformColor: function (baseMaterial) {
                const color = util.generateColor();
                const material = baseMaterial.override({ color: hex_color(color) });
                return () => material;
            },
            uniformDullColor: function (baseMaterial) {
                const rgb = util.hsvToRgb(Math.random(), .6, 1)
                const hex = util.rgbToHex(rgb[0], rgb[1], rgb[2]);
                const colorVec = hex_color(hex);
                const material = baseMaterial.override({ color: colorVec });
                return () => material;
            },

        }

        this.difficulty = .1;
        this.depth = 1000;
        this.radius = 1;
        this.game_running = false;
        this.start_points = [
            vec4(1, 1, 1, 1),
            vec4(1, 1, -1, 1),
            vec4(1, -1, 1, 1),
            vec4(1, -1, -1, 1),
            vec4(-1, 1, 1, 1),
            vec4(-1, 1, -1, 1),
            vec4(-1, -1, 1, 1),
            vec4(-1, -1, -1, 1),
        ]

        this.initialize_game();
    }

    initialize_game() {
        this.score = 0;
        this.health = 100;
        this.z_velocity = 0;
        this.thrust = vec4(0, 0, 0, 0);
        this.time_of_death = 0;

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 1), vec3(0, 0, 0), vec3(0, 1, 0));
        this.displacement = 5;
        this.box_pos = Mat4.translation(0, 0, -30);
        this.start_depth = -30
        this.z_displacement = 0;
        this.collided_with = 0
        this.first_person = false
        this.angle = 0
        this.total_angle = 0
        this.resting = false
        this.regen_start = 0
        this.dx = 0
        this.dy = 0
        this.pure_box_translation = Mat4.identity()
        this.position = vec4(0, 0, 0, 1)
        // Initialize Walls

        this.walls = new dropper.Walls(this.depth, this.shapes.wall, this.materials.wall)
        let texture_coord = this.walls.shape.arrays.texture_coord;
        for (let i = 0; i < texture_coord.length; i++) {
            this.walls.shape.arrays.texture_coord[i] = vec(
                texture_coord[i][0] * constants.WALL_SIDE_LENGTH,
                texture_coord[i][1] * (this.depth/constants.WALL_SIDE_LENGTH)
            );
        }

        // Initialize Platforms


        // look straight down at negative z, up is y, right is x
        this.spawn_pos = -300;
        this.platforms = [new dropper.UniformScatterPlatform(this.spawn_pos, this.shapes.square,
            this.difficulty, this.dynamicMaterials.uniformColor(this.materials.platform))]
        this.collidedPlatforms = [];
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("PAUSE / PLAY", [" "], () => this.game_running = !this.game_running)
        this.key_triggered_button("Perspective", ["e"], () => this.first_person = !this.first_person)
        this.new_line();
        this.new_line();
        this.key_triggered_button("Up", ["w"], () => this.thrust[1] = this.displacement, undefined, () => this.thrust[1] = 0);
        this.new_line();
        this.key_triggered_button("Left", ["a"], () => this.thrust[0] = -this.displacement, undefined, () => this.thrust[0] = 0);
        this.key_triggered_button("Down", ["s"], () => this.thrust[1] = -this.displacement, undefined, () => this.thrust[1] = 0);
        this.key_triggered_button("Right", ["d"], () => this.thrust[0] = this.displacement, undefined, () => this.thrust[0] = 0);
        this.new_line();
        this.new_line();
        this.key_triggered_button("Rotate left", ["f"], () => {this.angle = 5}, undefined, () => this.angle = 0)    
        this.key_triggered_button("Rotate right", ["g"], () => {this.angle = -5}, undefined, () => this.angle = 0)    
    }

    calculate_health_color() {
        const hue = this.health * 0.02; // scale to value between 0 & 2
        const x = 1- Math.abs(hue % 2 - 1);
        return hue < 1 ? color(1, x, 0, 1) : color(x, 1, 0, 1);
    }

    getPlayerPosition(matrix) {
        return { x: matrix[0][3], y: matrix[1][3] }
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
        

        if (this.health <= 0 && t - this.time_of_death > 1) {
            program_state.set_camera(this.initial_camera_location)
            if (t - this.time_of_death < 4) {
                const scale_factor = 5 * Math.min(t - this.time_of_death - 1, 2)
                this.shapes.square.draw(
                    context,
                    program_state,
                    Mat4.translation(0,0,-30).times(Mat4.scale(scale_factor, scale_factor, 1)),
                    this.materials.wasted//this.calculate_health_color()})
                )
            }
            else {
                this.initialize_game();
            }
            return;
        }

        let displacement = 0;
        if (this.game_running) {
            this.total_angle += this.angle
            if (!this.first_person) {
                this.position[0] += this.thrust[0] * dt
                this.position[1] += this.thrust[1] * dt
            }
            else {
                let third_person_thrust = Mat4.rotation(this.total_angle/100, 0, 0, 1).times(this.thrust)
                this.position[0] += third_person_thrust[0] * dt
                this.position[1] += third_person_thrust[1] * dt
            }

            // PHYSICS [Calculate Speed]
            this.z_velocity += (constants.g - constants.drag * this.z_velocity ** 2) * dt;

            // COLLISION CHECKING AND DAMAGE
            // Call Collision Checker

            while (this.collided_with > 0) {
                if (!this.resting) {
                    this.health -= (50 * this.z_velocity) / constants.terminal_velocity;
                    this.dx = Math.random() * 0.6
                    this.dy = Math.random() * 0.6
                }
                // DO INELASTIC COLLISION SIMULATION
                this.z_velocity = Math.sqrt(this.z_velocity);
                this.resting = true;

                if (this.health <= 0) {
                    this.time_of_death = t;
                    this.game_running = false;
                }
                this.collided_with -= 1
            }

            if (this.z_velocity > 0) {
                if (this.resting) this.regen_start = t;
                this.resting = false;
                if (t - this.regen_start > 1) this.health += 0.0005 * (100 - this.health)
                this.health = Math.min(this.health, 100);
            }

            displacement = this.z_velocity * dt;
        }



        let initial_box_pos = Mat4.translation(this.position[0], this.position[1], this.start_depth).times(Mat4.rotation(this.total_angle/100, 0, 0, 1))
        let player_points = this.start_points.map(x => initial_box_pos.times(x))

        let max_left = player_points[0][0], max_right = player_points[0][0], max_up = player_points[0][1], max_down = player_points[0][1]
        for (let i = 1; i < 8; ++i) {
            max_left = Math.min(max_left, player_points[i][0])
            max_right = Math.max(max_right, player_points[i][0])
            max_down = Math.min(max_down, player_points[i][1])
            max_up = Math.max(max_up, player_points[i][1])
        }
        let adjust_box = Mat4.identity();
        if (max_left < -constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(-constants.WALL_SIDE_LENGTH - max_left, 0, 0))
        if (max_right > constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(constants.WALL_SIDE_LENGTH - max_right, 0, 0))
        if (max_down < -constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(0, -constants.WALL_SIDE_LENGTH - max_down, 0))
        if (max_up > constants.WALL_SIDE_LENGTH)
            adjust_box = adjust_box.times(Mat4.translation(0, constants.WALL_SIDE_LENGTH - max_up, 0))

        this.box_pos = Mat4.translation(this.position[0], this.position[1], this.start_depth)
        this.box_pos = this.box_pos.times(adjust_box)
        this.box_pos = this.box_pos.times(Mat4.rotation(this.total_angle/100, 0, 0, 1))
        this.box_pos_vec = this.box_pos.times(vec4(0, 0, 0, 1))


        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 0, 5, 1);
        const second_light_position = vec4(0, 0, 20, 1)
        // The parameters of the Light are: position, color, size
        const health_color = this.calculate_health_color();
        const white = hex_color("#ffffff");
        program_state.lights = [new Light(second_light_position, white, 1000000)];


        this.z_displacement += displacement;

        //let wall_transform_x = model_transform.times(Mat4.scale(1, 10, 10))
        //let wall_transform_y = base_transform.times(Mat4.rotation(Math.PI/2, 0, 1, 0))

        // DRAW PLAYER
        if (!this.first_person) {
            let desired = this.initial_camera_location
            program_state.camera_inverse = desired.map((x,i) =>
                    Vector.from(program_state.camera_inverse[i]).mix(x, 0.1))
            this.shapes.square.draw(
                context,
                program_state,
                this.box_pos,//.times(Mat4.rotation(Math.PI, 1, 0, 0)),
                this.materials.player.override({
                    scale: 5 * Math.pow((0.01 * (100 - this.health)), 2),
                    dx: this.dx,
                    dy: this.dy,
                })
            )
        }
        else {
            let desired = Mat4.inverse(this.box_pos)
            program_state.camera_inverse = desired.map((x,i) =>
                    Vector.from(program_state.camera_inverse[i]).mix(x, 0.1))
             // might be slow, optimize by modifying position in camera space instead
        }
        

        if (this.platforms.length < 3) {
            this.score++;
            this.difficulty += .002;
            const last_pos = this.platforms[this.platforms.length-1].position + displacement
            const next_pos = last_pos - (Math.pow((1 - this.difficulty), 2) * 300)
            // console.log((last_pos - next_pos), this.difficulty)
            if (this.difficulty >= .8) this.difficulty = .5;

            let random = Math.floor(9 * Math.random()) + 1;
            if (random < 4) {
                this.platforms.push(new dropper.UniformScatterPlatform(next_pos, this.shapes.square, this.difficulty,
                    this.dynamicMaterials.uniformColor(this.materials.platform)));
            } else if (random < 8) {
                this.platforms.push(new dropper.VaryingDepthScatterPlatform(next_pos, this.shapes.square, this.difficulty,
                    this.dynamicMaterials.uniformColor(this.materials.platform), 3));
            } else {
                this.platforms.push(new dropper.NHolesPlatform(next_pos, this.shapes.square, this.dynamicMaterials.uniformColor(this.materials.platform), 3, 3));
            }

        }

        // render platforms
        for (let i = 0; i < this.platforms.length; ++i) {
            const platform = this.platforms[i];
            for (let j = 0; j < platform.shapePackages.length; ++j) {
                const shapePackage = platform.shapePackages[j];

                let object_start = Mat4.translation(shapePackage.x, shapePackage.y, platform.position + displacement + shapePackage.z)
                //let object_pos = object_start.times(vec4(0, 0, 0, 1)
                if (platform.material() == null)
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, this.materials.test)
                else
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, platform.material())
                if (platform.hasCollided === false && util.check_cube_with_cube_collision(this.box_pos, object_start, this.start_points, player_points)) {
                    platform.hasCollided = true;
                    this.collided_with++;
                }
            }
            platform.position += displacement
        }
        
        // change filter 
        let collided = this.platforms.filter(x => x.hasCollided === true);
        if (collided.length > 0) {
            let { x, y } = this.getPlayerPosition(this.box_pos);
            for (let i = 0; i < collided.length; i++) {
                collided[i].collide(x, y, this.z_velocity);
            }
        }
        this.collidedPlatforms = this.collidedPlatforms.concat(collided);
        this.platforms = this.platforms.filter(x => x.position < 10 && x.hasCollided === false);

        // render collided platforms
        for (let i = 0; i < this.collidedPlatforms.length; i++) {
            const platform = this.collidedPlatforms[i];
            platform.iteratePhysics(dt);
            for (let j = 0; j < platform.shapePackages.length; j++) {
                const shapePackage = platform.shapePackages[j];
                let object_start = Mat4.translation(shapePackage.x, shapePackage.y, platform.position + shapePackage.z)
                object_start = object_start.times(Mat4.rotation(shapePackage.xRot, 1, 0, 0));
                object_start = object_start.times(Mat4.rotation(shapePackage.yRot, 0, 1, 0));
                object_start = object_start.times(Mat4.rotation(shapePackage.zRot, 0, 0, 1));
                if (platform.material() == null)
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, this.materials.test)
                else
                    platform.shapes[shapePackage.shapeIndex].draw(context, program_state, object_start, platform.material())
            }
        }
        this.collidedPlatforms = this.collidedPlatforms.filter(x => x.isDead() === false);

        for (let i = 0; i < this.walls.wall_transforms.length; ++i) {
            this.walls.shape.draw(context, program_state, this.walls.wall_transforms[i],
                this.materials.wall.override({
                    displacement: (this.z_displacement * 0.05) % 1.0,
                    color: health_color
                })
            )
        }
    }
}

class Dynamic_Texture extends defs.Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float scale;
            uniform float dx;
            uniform float dy;
            
            void main(){
                // Sample the texture image in the correct place:
                vec2 translated_tex_coord = vec2(dx + f_tex_coord.x * 0.3, dy + f_tex_coord.y * 0.3);  
                vec4 tex_color = texture2D( texture, translated_tex_coord);

                
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz * scale + shape_color.xyz * (1.0 - scale)) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

class Textured_Scroll extends defs.Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            uniform float displacement;
            
            void main(){
                // Sample the texture image in the correct place:
                vec2 translated_tex_coord = vec2(f_tex_coord.x, f_tex_coord.y - displacement);  
                vec4 tex_color = texture2D( texture, translated_tex_coord);
                
                
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }

    /* send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.

        super.send_material(gl, gpu, material);
        gl.uniform1f(gpu.speed, material.speed);
    }*/
}