const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "docs"),
    filename: "scripts/bundle.[contenthash:8].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/dlv.html.template",
      filename: "dlv.html",
      inject: "body",
    }),
    new MiniCssExtractPlugin({
      filename: "styles/[name].[contenthash:8].css",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "app/config.json", to: "config.json" },
        { from: "app/images/icon.svg", to: "images/icon.svg" },
      ],
    }),
  ],
};
