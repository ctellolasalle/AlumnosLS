class AlumnosApp {
    constructor() {
        this.busquedaActiva = false;
        this.resultadosActuales = [];
        this.ordenActual = { columna: null, ascendente: true };
        this.searchTimer = null;
        this.hasUserInteracted = false;
        this.currentUser = null;
        this.isInitialized = false;
        
        console.log('Inicializando AlumnosApp...');
        this.init();
    }
    
    async init() {
        // SOLO verificar auth UNA vez al inicio
        try {
            console.log('Verificando autenticacion...');
            const response = await fetch('/auth/status');
            const data = await response.json();
            
            if (data.authenticated && data.user) {
                console.log('Usuario autenticado:', data.user.email);
                this.currentUser = data.user;
                this.setupApp();
            } else {
                console.log('No autenticado, redirigiendo...');
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Error de autenticacion:', error);
            window.location.href = '/login';
        }
    }
    
    setupApp() {
        if (this.isInitialized) {
            console.log('App ya inicializada');
            return;
        }
        
        console.log('Configurando aplicacion...');
        this.isInitialized = true;
        
        // Obtener elementos del DOM
        this.searchInput = document.getElementById('searchInput');
        this.clearButton = document.getElementById('clearButton');
        this.searchStatus = document.getElementById('searchStatus');
        this.resultsCount = document.getElementById('resultsCount');
        this.loading = document.getElementById('loading');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.tableBody = document.getElementById('tableBody');
        this.emptyState = document.getElementById('emptyState');
        this.filterToggle = document.getElementById('filterToggle');
        this.filterSection = document.getElementById('filterSection');
        this.filterLabel = document.getElementById('filterLabel');
        this.estadoRadios = document.querySelectorAll('input[name="estado"]');
        this.tableHeaders = document.querySelectorAll('[data-sort]');
        
        // Configurar eventos
        this.setupEvents();
        this.createUserMenu();
        this.updateFilterLabel();
        
        if (this.searchInput) {
            this.searchInput.focus();
        }
        
        console.log('App configurada exitosamente');
    }
    
    setupEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.onSearchChange());
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.limpiarBusqueda();
            });
        }
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.limpiarBusqueda());
        }
        
        if (this.filterToggle) {
            this.filterToggle.addEventListener('click', () => this.toggleFilter());
        }
        
        this.estadoRadios.forEach(radio => {
            radio.addEventListener('change', () => this.onFilterChange());
        });
        
        this.tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const columna = header.dataset.sort;
                this.ordenarPorColumna(columna);
            });
        });
    }
    
    createUserMenu() {
        const header = document.querySelector('.header-content');
        if (!header || !this.currentUser) return;
        
        const existingTitle = header.querySelector('.header-title');
        if (existingTitle) existingTitle.remove();
        
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu-container';
        userMenu.innerHTML = `
            <div class="user-info">
                <img src="${this.currentUser.photo}" alt="${this.currentUser.name}" class="user-avatar">
                <div class="user-details">
                    <span class="user-name">${this.currentUser.name}</span>
                    <span class="user-email">${this.currentUser.email}</span>
                </div>
                <button class="logout-btn" onclick="alumnosApp.logout()">Cerrar Sesion</button>
            </div>
        `;
        
        header.appendChild(userMenu);
        this.addUserMenuStyles();
    }
    
    addUserMenuStyles() {
        if (document.getElementById('user-menu-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'user-menu-styles';
        style.textContent = `
            .user-menu-container {
                margin-left: auto;
            }
            .user-info {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 0.5rem;
            }
            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid rgba(255, 255, 255, 0.3);
            }
            .user-details {
                display: flex;
                flex-direction: column;
                color: white;
                text-align: right;
            }
            .user-name {
                font-weight: 600;
                font-size: 0.9rem;
            }
            .user-email {
                font-size: 0.75rem;
                opacity: 0.8;
            }
            .logout-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.85rem;
            }
            .logout-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            @media (max-width: 768px) {
                .user-details { display: none; }
                .user-avatar { width: 32px; height: 32px; }
            }
        `;
        document.head.appendChild(style);
    }
    
    async logout() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            window.location.href = '/login';
        }
    }
    
    onSearchChange() {
        const texto = this.searchInput?.value?.trim() || '';
        
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        
        if (texto) {
            this.updateSearchStatus('Buscando...', 'searching');
            this.searchTimer = setTimeout(() => this.realizarBusqueda(texto), 300);
        } else {
            this.limpiarResultados();
            this.updateSearchStatus('Escriba para buscar en tiempo real...', 'idle');
        }
    }
    
    async realizarBusqueda(texto) {
        if (this.busquedaActiva) return;
        
        this.busquedaActiva = true;
        this.showLoading(true);
        
        try {
            const estado = this.getSelectedEstado();
            const response = await fetch(`/api/alumnos/buscar?texto=${encodeURIComponent(texto)}&estado=${estado}`);
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.mostrarResultados(data.data);
            } else {
                this.mostrarError(data.message || 'Error desconocido');
            }
            
        } catch (error) {
            this.mostrarError('Error de conexion');
        } finally {
            this.showLoading(false);
            this.busquedaActiva = false;
        }
    }
    
    getSelectedEstado() {
        const selected = document.querySelector('input[name="estado"]:checked');
        return selected ? selected.value : 'activos';
    }
    
    mostrarResultados(resultados) {
        this.resultadosActuales = resultados;
        this.actualizarTabla();
        this.actualizarContador(resultados.length);
        
        if (resultados.length === 0) {
            if (this.resultsContainer) this.resultsContainer.style.display = 'none';
            if (this.emptyState) this.emptyState.style.display = 'block';
            this.updateSearchStatus('No se encontraron coincidencias', 'empty');
        } else {
            if (this.resultsContainer) this.resultsContainer.style.display = 'block';
            if (this.emptyState) this.emptyState.style.display = 'none';
            this.updateSearchStatus('Busqueda completada', 'success');
        }
    }
    
    actualizarTabla() {
        if (!this.tableBody) return;
        
        this.tableBody.innerHTML = '';
        this.resultadosActuales.forEach((alumno, index) => {
            const row = document.createElement('div');
            row.className = `table-row ${index % 2 === 0 ? 'even' : 'odd'}`;
            row.innerHTML = `
                <div class="table-cell table-cell-alumno">${this.escapeHtml(alumno.ApNom)}</div>
                <div class="table-cell table-cell-curso">${this.escapeHtml(alumno.denominacion)}</div>
            `;
            this.tableBody.appendChild(row);
        });
    }
    
    ordenarPorColumna(columna) {
        if (!this.resultadosActuales.length) return;
        
        if (this.ordenActual.columna === columna) {
            this.ordenActual.ascendente = !this.ordenActual.ascendente;
        } else {
            this.ordenActual.columna = columna;
            this.ordenActual.ascendente = true;
        }
        
        const campo = columna === 'alumno' ? 'ApNom' : 'denominacion';
        this.resultadosActuales.sort((a, b) => {
            const valueA = a[campo].toUpperCase();
            const valueB = b[campo].toUpperCase();
            
            if (this.ordenActual.ascendente) {
                return valueA.localeCompare(valueB);
            } else {
                return valueB.localeCompare(valueA);
            }
        });
        
        this.actualizarTabla();
    }
    
    toggleFilter() {
        if (!this.filterSection) return;
        
        const isVisible = this.filterSection.style.display !== 'none';
        this.filterSection.style.display = isVisible ? 'none' : 'block';
    }
    
    onFilterChange() {
        this.updateFilterLabel();
        
        const texto = this.searchInput?.value?.trim() || '';
        if (texto) {
            this.onSearchChange();
        }
        
        setTimeout(() => {
            if (this.filterSection) this.filterSection.style.display = 'none';
        }, 300);
    }
    
    updateFilterLabel() {
        const selected = document.querySelector('input[name="estado"]:checked');
        if (selected && this.filterLabel) {
            const labels = {
                'activos': 'Solo Activos',
                'egresados': 'Solo Egresados',
                'todos': 'Todos'
            };
            this.filterLabel.textContent = labels[selected.value] || 'Solo Activos';
        }
    }
    
    actualizarContador(cantidad) {
        if (!this.resultsCount) return;
        
        let texto = '';
        if (cantidad === 0) {
            texto = 'Sin resultados';
        } else if (cantidad === 1) {
            texto = '1 resultado';
        } else {
            texto = `${cantidad} resultados`;
        }
        this.resultsCount.textContent = texto;
    }
    
    updateSearchStatus(mensaje, tipo) {
        if (!this.searchStatus) return;
        
        this.searchStatus.textContent = mensaje;
        this.searchStatus.classList.remove('searching', 'success', 'error', 'empty');
        
        if (tipo !== 'idle') {
            this.searchStatus.classList.add(tipo);
        }
    }
    
    showLoading(show) {
        if (this.loading) {
            this.loading.style.display = show ? 'flex' : 'none';
        }
        
        if (show) {
            if (this.resultsContainer) this.resultsContainer.style.display = 'none';
            if (this.emptyState) this.emptyState.style.display = 'none';
        }
    }
    
    mostrarError(mensaje) {
        this.updateSearchStatus(`Error: ${mensaje}`, 'error');
        if (this.resultsCount) this.resultsCount.textContent = 'Error';
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        if (this.emptyState) this.emptyState.style.display = 'none';
    }
    
    limpiarBusqueda() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchInput.focus();
        }
        this.limpiarResultados();
    }
    
    limpiarResultados() {
        if (this.tableBody) this.tableBody.innerHTML = '';
        if (this.resultsCount) this.resultsCount.textContent = '';
        this.resultadosActuales = [];
        this.ordenActual = { columna: null, ascendente: true };
        
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        if (this.emptyState) this.emptyState.style.display = 'none';
        this.showLoading(false);
        
        this.updateSearchStatus('Escriba para buscar en tiempo real...', 'idle');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Variable global para acceso al logout
let alumnosApp;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando app...');
    alumnosApp = new AlumnosApp();
});