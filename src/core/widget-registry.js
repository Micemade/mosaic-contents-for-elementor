/**
 * Widget Registry
 * 
 * Central registry mapping widget names to their React components and settings mappers.
 * Add new widgets here to make them available throughout the system.
 */

import { createSettingsMapper } from '../widgets/settings-mappers';

// Import React components for each widget type
import ContentLayoutWidget from '../widgets/content-layout/content-layout';

// Settings definitions for each widget React component (imported from JSON files generated from PHP)
import productsSettingsDef from '../../widgets/content-layout/react-settings.json';

// Registry mapping widget types to their configurations
export const WIDGET_REGISTRY = {
	'content-layout': {
		component: ContentLayoutWidget,
		settingsMapper: createSettingsMapper(productsSettingsDef)
	}
};

// Get list of all registered widget types
export const getRegisteredWidgets = () => Object.keys(WIDGET_REGISTRY);

// Check if a widget type is registered
export const isWidgetRegistered = (widgetType) => !!WIDGET_REGISTRY[widgetType];

// Get widget configuration
export const getWidgetConfig = (widgetType) => WIDGET_REGISTRY[widgetType];
