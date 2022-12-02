

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
    
    check_square_with_square_collision(square_1_center, square_1_radius, square_2_center, square_2_radius) {
            let z_distance = square_1_center[2] - square_2_center[2]
            if (Math.abs(z_distance) > square_1_radius + square_2_radius)
                return false
            
            let y_distance = square_1_center[1] - square_2_center[1]
            if (Math.abs(y_distance) > square_1_radius + square_2_radius)
                return false

            let x_distance = square_1_center[0] - square_2_center[0]
            if (Math.abs(x_distance) > square_1_radius + square_2_radius)
                return false

            return true
    }

}

export default util;