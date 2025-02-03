import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties
} from 'n8n-workflow';

export class CalibreWebApi implements ICredentialType {
	name = 'calibreWebApi';
	displayName = 'Calibre Web API';
	icon = { light: 'file:calibre-web.svg', dark: 'file:calibre-web.svg' } as const;
	documentationUrl = 'https://github.com/janeczku/calibre-web';
	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Username for Calibre Web authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Password for Calibre Web authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://calibre.example.com',
			description: 'Base URL of your Calibre Web instance. Must use HTTPS in production for security. Do not include trailing slashes.',
			validateType: 'url',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{ $credentials.username }}',
				password: '={{ $credentials.password }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/',
			method: 'GET',
		},
	};
}
