import { defs, tiny } from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

const util = {
    generateColor() {
        let n = (Math.random() * 0xfffff * 1000000).toString(16);
        return '#' + n.slice(0, 6);
    },
    hsvToRgb(h, s, v) {
        var r, g, b;

        var i = Math.floor(h * 6);
        var f = h * 6 - i;
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
    },
    rgbToHex(r, g, b) {
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    },
    
    check_cube_with_cube_collision(player_transform, object_transform, start_points, player_points, player_size = 1, object_size = 1) {
        let object_center = object_transform.times(vec4(0, 0, 0, 1))
        for (let i = 0; i < player_points.length; ++i) {                
            let point_vec = object_center.minus(player_points[i])
            if (Math.abs(point_vec[0]) < object_size && Math.abs(point_vec[1]) < object_size && Math.abs(point_vec[2]) < object_size)
                return true
        }
        let object_points = start_points.map(x => object_transform.times(x))
        let player_center = player_transform.times(vec4(0, 0, 0, 1))
        for (let i = 0; i < object_points.length; ++i) {                
            let point_vec = player_center.minus(object_points[i])
            if (Math.abs(point_vec[0]) < player_size && Math.abs(point_vec[1]) < player_size && Math.abs(point_vec[2]) < player_size)
                return true
        }
        return false
    }

}

export default util;