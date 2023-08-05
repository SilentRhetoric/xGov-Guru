# Algorand xGov Proposal Viewer

This is a web app tool to make it easier to browse Algorand xGov proposals. It runs entirely in the browser and retrieves xGov session information from the Algorand Foundation IPFS pin and the full text of the proposals from GitHub by their pull request number on the [xGov](https://github.com/algorandfoundation/xGov) repository.

## Usage

To run the site locally, clone the repository and run

```bash
$ npm install # or pnpm install or yarn install
```

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

You can deploy the `dist` folder to any static host provider.
