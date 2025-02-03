![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-calibre-web

This is an n8n community node. It lets you use Calibre Web in your n8n workflows.

Calibre Web is a web app providing a clean interface for browsing, reading and downloading eBooks using an existing Calibre database. This node allows you to automate book uploads to your Calibre Web instance.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  

## Prerequisites

You need the following installed on your development machine:

* [git](https://git-scm.com/downloads)
* Node.js and pnpm. Minimum version Node 18. You can find instructions on how to install both using nvm (Node Version Manager) for Linux, Mac, and WSL [here](https://github.com/nvm-sh/nvm). For Windows users, refer to Microsoft's guide to [Install NodeJS on Windows](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows).
* Install n8n with:
  ```
  pnpm install n8n -g
  ```
* Recommended: follow n8n's guide to [set up your development environment](https://docs.n8n.io/integrations/creating-nodes/build/node-development-environment/).

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

* Upload Book
  * Upload a new book to your Calibre Web instance

## Credentials

You need the following to use this node:
1. A running Calibre Web instance
2. Username and password for authentication
3. Base URL of your Calibre Web instance (e.g., https://calibre.example.com)

## Compatibility

* Requires n8n version 1.0.0 or later
* Tested with Calibre Web version 0.6.24 and later

## Troubleshooting

* If you encounter authentication issues:
  * Verify your credentials and base URL are correct
  * Ensure your Calibre Web instance is accessible from n8n
  * Check if your user has upload permissions

* For upload failures:
  * Verify the file format is supported (epub, mobi, pdf, etc.)
  * Check if the file size is within your server's limits

Debug logs can be enabled in n8n settings to get more detailed error information.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Calibre Web documentation](https://github.com/janeczku/calibre-web)

## License

[MIT](LICENSE.md)
