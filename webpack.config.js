const path = require("path");
const { merge } = require("webpack-merge");

const common_config = {
    entry: "/src/main.js",
    output: {
	filename: "main.js",
	path: path.resolve(__dirname, "dist"),
    }
}

const dev_config = {
    name: "dev",
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
	contentBase: "./dist",
    },
}

const prod_config = {
    name: "prod",
    mode: "production",
}


module.exports = [
    merge(common_config, dev_config),
    merge(common_config, prod_config),
]
