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
