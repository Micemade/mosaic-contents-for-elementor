/**
 * Focal Point Control View
 * 
 * React-based view for the focal point picker control.
 * Uses @lemoncode/react-image-focal-point for the visual picker.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * FocalPointPicker React Component
 * 
 * A visual picker for selecting X/Y coordinates on a container.
 * Shows a draggable point that can be moved to select position.
 */
const FocalPointPicker = ({ 
	initialX = 50, 
	initialY = 50, 
	previewImage = '',
	onChange 
}) => {
	const [x, setX] = useState(initialX);
	const [y, setY] = useState(initialY);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = React.useRef(null);

	/**
	 * Calculate position from mouse/touch event
	 */
	const calculatePosition = useCallback((event) => {
		if (!containerRef.current) return null;

		const rect = containerRef.current.getBoundingClientRect();
		const clientX = event.touches ? event.touches[0].clientX : event.clientX;
		const clientY = event.touches ? event.touches[0].clientY : event.clientY;

		const newX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
		const newY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

		return { x: newX, y: newY };
	}, []);

	/**
	 * Handle mouse/touch move
	 */
	const handleMove = useCallback((event) => {
		if (!isDragging) return;
		
		event.preventDefault();
		const pos = calculatePosition(event);
		
		if (pos) {
			setX(pos.x);
			setY(pos.y);
			onChange?.(pos.x, pos.y);
		}
	}, [isDragging, calculatePosition, onChange]);

	/**
	 * Handle mouse/touch start
	 */
	const handleStart = useCallback((event) => {
		event.preventDefault();
		setIsDragging(true);
		
		const pos = calculatePosition(event);
		if (pos) {
			setX(pos.x);
			setY(pos.y);
			onChange?.(pos.x, pos.y);
		}
	}, [calculatePosition, onChange]);

	/**
	 * Handle mouse/touch end
	 */
	const handleEnd = useCallback(() => {
		setIsDragging(false);
	}, []);

	/**
	 * Attach global event listeners for dragging
	 */
	useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMove);
			document.addEventListener('mouseup', handleEnd);
			document.addEventListener('touchmove', handleMove, { passive: false });
			document.addEventListener('touchend', handleEnd);
		}

		return () => {
			document.removeEventListener('mousemove', handleMove);
			document.removeEventListener('mouseup', handleEnd);
			document.removeEventListener('touchmove', handleMove);
			document.removeEventListener('touchend', handleEnd);
		};
	}, [isDragging, handleMove, handleEnd]);

	/**
	 * Update position from external changes
	 */
	useEffect(() => {
		setX(initialX);
		setY(initialY);
	}, [initialX, initialY]);

	return (
		<div 
			ref={containerRef}
			className="mpl4e-focal-point-picker"
			onMouseDown={handleStart}
			onTouchStart={handleStart}
		>
			{/* Preview image if provided */}
			{previewImage && (
				<img src={previewImage} alt="Preview" />
			)}

			{/* Grid lines for visual reference */}
			{(() => {
				const gridLineColor = 'var(--e-a-border-color, rgb(221, 221, 221))';
				const gridPositions = [25, 50, 75];
				
				return (
					<div className="mpl4e-focal-point-grid">
						{/* Horizontal lines */}
						{gridPositions.map((pos) => (
							<div 
								key={`h-${pos}`}
								style={{ 
									position: 'absolute', 
									top: `${pos}%`, 
									left: 0, 
									right: 0, 
									borderTop: `1px dashed ${gridLineColor}` 
								}} 
							/>
						))}
						
						{/* Vertical lines */}
						{gridPositions.map((pos) => (
							<div 
								key={`v-${pos}`}
								style={{ 
									position: 'absolute', 
									left: `${pos}%`, 
									top: 0, 
									bottom: 0, 
									borderLeft: `1px dashed ${gridLineColor}` 
								}} 
							/>
						))}
					</div>
				);
			})()}

			{/* Focal point marker */}
			<div 
				className="mpl4e-focal-point-marker"
				style={{
					left: `${x}%`,
					top: `${y}%`,
					cursor: isDragging ? 'grabbing' : 'grab',
					transition: isDragging ? 'none' : 'left 0.1s, top 0.1s',
				}}
			>
				{/* Center dot */}
				<div className="mpl4e-focal-point-center-dot" />
			</div>

			{/* Corner labels */}
			<div className="mpl4e-focal-point-labels">
				<span style={{ position: 'absolute', top: '4px', left: '4px' }}>0,0</span>
				<span style={{ position: 'absolute', top: '4px', right: '4px' }}>100,0</span>
				<span style={{ position: 'absolute', bottom: '4px', left: '4px' }}>0,100</span>
				<span style={{ position: 'absolute', bottom: '4px', right: '4px' }}>100,100</span>
			</div>
		</div>
	);
};

/**
 * FocalPointControlView Class
 * 
 * Manages the lifecycle of the React component within Elementor's control system.
 */
export class FocalPointControlView {
	constructor(options) {
		this.container = options.container;
		this.initialX = options.initialX || 50;
		this.initialY = options.initialY || 50;
		this.previewImage = options.previewImage || '';
		this.onChange = options.onChange;
		this.root = null;
		this.currentX = this.initialX;
		this.currentY = this.initialY;
	}

	/**
	 * Render the React component
	 */
	render() {
		if (!this.container) return;

		this.root = createRoot(this.container);
		this.root.render(
			<FocalPointPicker
				initialX={this.initialX}
				initialY={this.initialY}
				previewImage={this.previewImage}
				onChange={(x, y) => {
					this.currentX = x;
					this.currentY = y;
					this.onChange?.(x, y);
				}}
			/>
		);
	}

	/**
	 * Update position from external source
	 */
	updatePosition(x, y) {
		this.currentX = x;
		this.currentY = y;
		
		// Re-render with new values
		if (this.root && this.container) {
			this.root.render(
				<FocalPointPicker
					initialX={x}
					initialY={y}
					previewImage={this.previewImage}
					onChange={(newX, newY) => {
						this.currentX = newX;
						this.currentY = newY;
						this.onChange?.(newX, newY);
					}}
				/>
			);
		}
	}

	/**
	 * Destroy the React component
	 */
	destroy() {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}
}

export default FocalPointPicker;
