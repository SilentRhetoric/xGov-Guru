# xGov Guru

![image](https://i.ibb.co/hHj68Mx/xgov-guru-1200x630.png)

xGov Guru is a web app to explore Algorand xGov voting data and make it easier to read the full proposals. In the spirit of Web3, the app runs entirely in the browser and does not depend on any back-end server other than an Algorand Indexer.

Voting data is collected by searching an indexer for transactions to the smart contract. It is then processed and enriched to produce summary graphs with unique insights into the voting activity.

It retrieves xGov session information from the Algorand Foundation IPFS pin and the full text of the proposals from GitHub by their pull request number on the [xGov](https://github.com/algorandfoundation/xGov) repository.

xGov Guru is free open source software under the MIT license. As this is a tool for the community, pull requests are welcome.

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
