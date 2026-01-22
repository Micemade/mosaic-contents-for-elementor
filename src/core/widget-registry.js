/**
 * Widget Registry
 * 
 * Central registry mapping widget names to their React components and settings mappers.
 * Add new widgets here to make them available throughout the system.
 */

import ProductsLayoutWidget from '../widgets/products-layout/products-layout';
import { mapProductsLayoutSettings } from '../widgets/settings-mappers';

// Registry mapping widget types to their configurations
export const WIDGET_REGISTRY = {
	'products-layout': {
		component: ProductsLayoutWidget,
		settingsMapper: mapProductsLayoutSettings
	},
	// Future widgets will be added here:
	// 'categories-layout': {
	//     component: CategoriesLayoutWidget,
	//     settingsMapper: mapCategoriesLayoutSettings
	// },
	// 'single-product-layout': {
	//     component: SingleProductLayoutWidget,
	//     settingsMapper: mapSingleProductLayoutSettings
	// }
};

// Get list of all registered widget types
export const getRegisteredWidgets = () => Object.keys(WIDGET_REGISTRY);

// Check if a widget type is registered
export const isWidgetRegistered = (widgetType) => !!WIDGET_REGISTRY[widgetType];

// Get widget configuration
export const getWidgetConfig = (widgetType) => WIDGET_REGISTRY[widgetType];
