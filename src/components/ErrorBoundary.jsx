import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login">
          <div className="login-tarjeta">
            <h1 className="login-titulo">Ha ocurrido un error</h1>
            <p className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => this.setState({ error: null })}
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}