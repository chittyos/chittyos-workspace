import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          backgroundColor: '#111',
          color: 'white',
          minHeight: '100vh'
        }}>
          <h1 style={{ color: 'red' }}>Something went wrong!</h1>
          <pre style={{ color: 'orange' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ color: 'yellow' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary