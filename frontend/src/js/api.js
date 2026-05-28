// Configuración dinámica de la URL de la API según el entorno
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://control-yonf.onrender.com/api'; // Conectado a tu servidor real de Render

export async function fetchDashboardData() {
    try {
        const response = await fetch(`${API_URL}/dashboard`);
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al conectar con la API:', error);
        return null;
    }
}

export async function crearObligacion(data) {
    try {
        const response = await fetch(`${API_URL}/obligaciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error('Error al registrar la obligación en el servidor');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al enviar la nueva obligación:', error);
        return null;
    }
}

export async function crearTransaccion(data) {
    try {
        const response = await fetch(`${API_URL}/transacciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error('Error al registrar la transacción en el servidor');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al enviar la nueva transacción:', error);
        return null;
    }
}

export async function actualizarRegistro(id, tipo, data) {
    try {
        const response = await fetch(`${API_URL}/${tipo}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`Error al actualizar el registro de tipo ${tipo}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error al actualizar registro:', error);
        return null;
    }
}

export async function eliminarRegistro(id, tipo) {
    try {
        const response = await fetch(`${API_URL}/${tipo}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`Error al eliminar el registro de tipo ${tipo}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error al eliminar registro:', error);
        return null;
    }
}

// ==========================================
// MÓDULO DE INVERSIONES (APUESTAS - BETPLAY)
// ==========================================

export async function fetchInversionesData() {
    try {
        const response = await fetch(`${API_URL}/inversiones`);
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al conectar con la API de inversiones:', error);
        return null;
    }
}

export async function actualizarSaldoBetPlay(monto, tipoMovimiento, cuentaId) {
    try {
        const response = await fetch(`${API_URL}/inversiones/saldo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ monto, tipo_movimiento: tipoMovimiento, cuenta_id: cuentaId })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al actualizar el saldo de BetPlay');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al enviar actualización de saldo:', error);
        throw error;
    }
}

export async function crearApuesta(data) {
    try {
        const response = await fetch(`${API_URL}/inversiones/apuestas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al registrar la apuesta');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al registrar apuesta:', error);
        throw error;
    }
}

export async function actualizarEstadoApuesta(id, nuevoEstado) {
    try {
        const response = await fetch(`${API_URL}/inversiones/apuestas/${id}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nuevoEstado })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al resolver la apuesta');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al resolver apuesta:', error);
        throw error;
    }
}

export async function eliminarApuesta(id) {
    try {
        const response = await fetch(`${API_URL}/inversiones/apuestas/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al eliminar la apuesta');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al eliminar apuesta:', error);
        throw error;
    }
}

