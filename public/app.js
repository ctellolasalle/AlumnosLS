class AlumnosApp {
    constructor() {
        this.busquedaActiva = false;
        this.resultadosActuales = [];
        this.ordenActual = { columna: null, ascendente: true };
        this.searchTimer = null;
        this.hasUserInteracted = false; // Seguimiento de interaccion del usuario
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeApp();
    }
    
    initializeElements() {
        // Elementos del DOM
        this.searchInput = document.getElementById('searchInput');
        this.clearButton = document.getElementById('clearButton');
        this.searchStatus = document.getElementById('searchStatus');
        this.resultsCount = document.getElementById('resultsCount');
        this.loading = document.getElementById('loading');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.tableBody = document.getElementById('tableBody');
        this.emptyState = document.getElementById('emptyState');
        
        // Filter toggle elements
        this.filterToggle = document.getElementById('filterToggle');
        this.filterSection = document.getElementById('filterSection');
        this.filterLabel = document.getElementById('filterLabel');
        this.chevronIcon = this.filterToggle.querySelector('.chevron-icon');
        
        // Radio buttons de estado
        this.estadoRadios = document.querySelectorAll('input[name="estado"]');
        
        // Headers de tabla para ordenamiento
        this.tableHeaders = document.querySelectorAll('[data-sort]');
        
        // Estado del filtro
        this.filterOpen = false;
    }
    
    setupEventListeners() {
        // Busqueda en tiempo real
        this.searchInput.addEventListener('input', () => this.onSearchChange());
        
        // Filter toggle
        this.filterToggle.addEventListener('click', () => this.toggleFilter());
        
        // Cambio de filtro de estado
        this.estadoRadios.forEach(radio => {
            radio.addEventListener('change', () => this.onFilterChange());
        });
        
        // Boton limpiar
        this.clearButton.addEventListener('click', () => this.limpiarBusqueda());
        
        // Headers para ordenamiento
        this.tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const columna = header.dataset.sort;
                this.ordenarPorColumna(columna);
            });
        });
        
        // Eventos de teclado
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.limpiarBusqueda();
            }
        });
        
        // Prevenir zoom en iOS al hacer focus
        this.searchInput.addEventListener('touchstart', (e) => {
            this.searchInput.style.fontSize = '16px';
        });
        
        // Cerrar filtro al hacer click fuera (en TODAS las pantallas)
        document.addEventListener('click', (e) => {
            if (!this.filterToggle.contains(e.target) && 
                !this.filterSection.contains(e.target) && 
                this.filterOpen) {
                this.closeFilter();
            }
        });
    }
    
    initializeApp() {
        // Focus inicial en el campo de busqueda
        this.searchInput.focus();
        
        // Inicializar label del filtro
        this.updateFilterLabel();
        
        // Registrar service worker si esta disponible
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
        }
        
        // Ajustar interfaz segun tamaño de pantalla
        this.adjustForScreenSize();
        
        // Escuchar cambios de orientacion/tamaño
        window.addEventListener('resize', () => this.adjustForScreenSize());
    }
    
    adjustForScreenSize() {
        // En TODAS las pantallas, filtros cerrados por defecto
        if (this.filterOpen && !this.hasUserInteracted) {
            this.closeFilter();
        }
    }
    
    onSearchChange() {
        const texto = this.searchInput.value.trim();
        
        // Cancelar timer anterior
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        
        if (texto) {
            this.updateSearchStatus('Buscando...', 'searching');
            // Delay de 300ms para evitar demasiadas consultas
            this.searchTimer = setTimeout(() => this.realizarBusqueda(texto), 300);
        } else {
            this.limpiarResultados();
            this.updateSearchStatus('Escriba para buscar en tiempo real...', 'idle');
        }
    }
    
    onFilterChange() {
        // Actualizar label del filtro
        this.updateFilterLabel();
        
        // Realizar busqueda si hay texto
        const texto = this.searchInput.value.trim();
        if (texto) {
            this.onSearchChange();
        }
        
        // Cerrar filtro automaticamente en TODAS las pantallas
        setTimeout(() => this.closeFilter(), 300);
    }
    
    toggleFilter() {
        this.hasUserInteracted = true; // Usuario interactúo manualmente
        
        if (this.filterOpen) {
            this.closeFilter();
        } else {
            this.openFilter();
        }
    }
    
    openFilter() {
        this.filterOpen = true;
        this.filterSection.style.display = 'block';
        this.filterToggle.classList.add('active');
        
        // Enfocar en el primer radio button
        const firstRadio = this.filterSection.querySelector('input[type="radio"]');
        if (firstRadio) {
            setTimeout(() => firstRadio.focus(), 100);
        }
    }
    
    closeFilter() {
        this.filterOpen = false;
        this.filterSection.classList.add('hiding');
        this.filterToggle.classList.remove('active');
        
        // Ocultar despues de la animacion
        setTimeout(() => {
            this.filterSection.style.display = 'none';
            this.filterSection.classList.remove('hiding');
        }, 300);
    }
    
    updateFilterLabel() {
        const selectedRadio = document.querySelector('input[name="estado"]:checked');
        if (selectedRadio) {
            const labels = {
                'activos': 'Solo Activos',
                'egresados': 'Solo Egresados',
                'todos': 'Todos'
            };
            this.filterLabel.textContent = labels[selectedRadio.value] || 'Solo Activos';
        }
    }
    
    async realizarBusqueda(texto) {
        if (this.busquedaActiva) return;
        
        this.busquedaActiva = true;
        this.showLoading(true);
        
        try {
            const estado = this.getSelectedEstado();
            const response = await fetch(`/api/alumnos/buscar?texto=${encodeURIComponent(texto)}&estado=${estado}`);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.mostrarResultados(data.data);
            } else {
                this.mostrarError(data.message || 'Error desconocido');
            }
            
        } catch (error) {
            console.error('Error en busqueda:', error);
            this.mostrarError('Error de conexion. Verifique su red.');
        } finally {
            this.showLoading(false);
            this.busquedaActiva = false;
        }
    }
    
    getSelectedEstado() {
        const selectedRadio = document.querySelector('input[name="estado"]:checked');
        return selectedRadio ? selectedRadio.value : 'activos';
    }
    
    mostrarResultados(resultados) {
        this.resultadosActuales = resultados;
        this.actualizarTabla();
        this.actualizarContador(resultados.length);
        
        // Mostrar/ocultar elementos segun resultados
        if (resultados.length === 0) {
            this.resultsContainer.style.display = 'none';
            this.emptyState.style.display = 'block';
            this.updateSearchStatus('No se encontraron coincidencias', 'empty');
        } else {
            this.resultsContainer.style.display = 'block';
            this.emptyState.style.display = 'none';
            this.updateSearchStatus('Busqueda completada', 'success');
        }
    }
    
    actualizarTabla() {
        // Limpiar tabla
        this.tableBody.innerHTML = '';
        
        // Agregar filas
        this.resultadosActuales.forEach((alumno, index) => {
            const row = this.createTableRow(alumno, index);
            this.tableBody.appendChild(row);
        });
    }
    
    createTableRow(alumno, index) {
        const row = document.createElement('div');
        row.className = `table-row ${index % 2 === 0 ? 'even' : 'odd'}`;
        
        row.innerHTML = `
            <div class="table-cell table-cell-alumno">${this.escapeHtml(alumno.ApNom)}</div>
            <div class="table-cell table-cell-curso">${this.escapeHtml(alumno.denominacion)}</div>
        `;
        
        return row;
    }
    
    ordenarPorColumna(columna) {
        if (!this.resultadosActuales.length) return;
        
        // Determinar direccion de orden
        if (this.ordenActual.columna === columna) {
            this.ordenActual.ascendente = !this.ordenActual.ascendente;
        } else {
            this.ordenActual.columna = columna;
            this.ordenActual.ascendente = true;
        }
        
        // Ordenar resultados
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
        
        // Actualizar iconos de ordenamiento
        this.actualizarIconosOrden(columna);
        
        // Actualizar tabla
        this.actualizarTabla();
    }
    
    actualizarIconosOrden(columnaActiva) {
        this.tableHeaders.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            const columna = header.dataset.sort;
            
            if (columna === columnaActiva) {
                icon.classList.toggle('asc', this.ordenActual.ascendente);
                header.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            } else {
                icon.classList.remove('asc');
                header.style.backgroundColor = '';
            }
        });
    }
    
    actualizarContador(cantidad) {
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
        this.searchStatus.textContent = mensaje;
        
        // Remover clases anteriores
        this.searchStatus.classList.remove('searching', 'success', 'error', 'empty');
        
        // Agregar clase segun tipo
        if (tipo !== 'idle') {
            this.searchStatus.classList.add(tipo);
        }
    }
    
    showLoading(show) {
        this.loading.style.display = show ? 'flex' : 'none';
        
        if (show) {
            this.resultsContainer.style.display = 'none';
            this.emptyState.style.display = 'none';
        }
    }
    
    mostrarError(mensaje) {
        this.updateSearchStatus(`Error: ${mensaje}`, 'error');
        this.resultsCount.textContent = 'Error';
        this.resultsContainer.style.display = 'none';
        this.emptyState.style.display = 'none';
    }
    
    limpiarBusqueda() {
        this.searchInput.value = '';
        this.limpiarResultados();
        this.searchInput.focus();
    }
    
    limpiarResultados() {
        this.tableBody.innerHTML = '';
        this.resultsCount.textContent = '';
        this.resultadosActuales = [];
        this.ordenActual = { columna: null, ascendente: true };
        
        // Resetear iconos de ordenamiento
        this.tableHeaders.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            icon.classList.remove('asc');
            header.style.backgroundColor = '';
        });
        
        // Ocultar elementos
        this.resultsContainer.style.display = 'none';
        this.emptyState.style.display = 'none';
        this.showLoading(false);
        
        this.updateSearchStatus('Escriba para buscar en tiempo real...', 'idle');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar aplicacion cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
    new AlumnosApp();
});

// Registrar eventos globales
window.addEventListener('online', () => {
    console.log('Conexion restaurada');
});

window.addEventListener('offline', () => {
    console.log('Conexion perdida');
});