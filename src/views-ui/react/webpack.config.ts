const path = require("path");
import { Configuration } from "webpack";

const config: Configuration = {
  mode: "production",
  entry: path.resolve(__dirname, "./src/index.tsx"),
  resolve: {
    extensions: [".ts", ".tsx"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, "../../../out/views-ui/react/"),
    filename: "react_build.js",
  },
};

export default config;
