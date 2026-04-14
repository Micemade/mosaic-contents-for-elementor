/**
 * Widget Registry
 * 
 * Central registry mapping widget names to their React components and settings mappers.
 * Add new widgets here to make them available throughout the system.
 */

import { createSettingsMapper } from '../widgets/settings-mappers';

// Import React components for each widget type
import ProductsLayoutWidget from '../widgets/products-layout/products-layout';
import CategoriesLayoutWidget from '../widgets/categories-layout/categories-layout';
import SingleProductLayoutWidget from '../widgets/single-product-layout/single-product-layout';

// Settings definitions for each widget React component (imported from JSON files generated from PHP)
import productsSettingsDef from '../../widgets/products-layout/react-settings.json';
import categoriesSettingsDef from '../../widgets/categories-layout/react-settings.json';
import singleProductSettingsDef from '../../widgets/single-product-layout/react-settings.json';

// Registry mapping widget types to their configurations
export const WIDGET_REGISTRY = {
	'products-layout': {
		component: ProductsLayoutWidget,
		settingsMapper: createSettingsMapper(productsSettingsDef)
	},
	'categories-layout': {
		component: CategoriesLayoutWidget,
		settingsMapper: createSettingsMapper(categoriesSettingsDef)
	},
	'single-product-layout': {
		component: SingleProductLayoutWidget,
		settingsMapper: createSettingsMapper(singleProductSettingsDef)
	}
};

// Get list of all registered widget types
export const getRegisteredWidgets = () => Object.keys(WIDGET_REGISTRY);

// Check if a widget type is registered
export const isWidgetRegistered = (widgetType) => !!WIDGET_REGISTRY[widgetType];

// Get widget configuration
export const getWidgetConfig = (widgetType) => WIDGET_REGISTRY[widgetType];
