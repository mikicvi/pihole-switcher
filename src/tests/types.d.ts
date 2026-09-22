// This file adds custom type definitions for window._env_
interface Window {
	_env_?: {
		REACT_APP_PIHOLE_BASE: string;
		REACT_APP_PIHOLE_ADMIN?: string;
		[key: string]: any;
	};
}
