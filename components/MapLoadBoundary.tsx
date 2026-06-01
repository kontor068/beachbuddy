import React from 'react';

interface MapLoadBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  resetKey?: string | number;
}

interface MapLoadBoundaryState {
  hasError: boolean;
}

export class MapLoadBoundary extends React.Component<MapLoadBoundaryProps, MapLoadBoundaryState> {
  state: MapLoadBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapLoadBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: MapLoadBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
