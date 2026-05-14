import subprocess
import json

def generate_pdf(filename, items_count):
    items = []
    for i in range(items_count):
        items.append({
            "codigo": f"CAT-{i}",
            "descripcion": f"Repuesto de prueba para validacion de paginacion numero {i}",
            "cantidad": 1,
            "precio": 100.0,
            "total": 100.0
        })
    
    payload = {
        "id": "123",
        "fecha": "2023-10-27",
        "cliente": "Cliente de Prueba",
        "placa": "ABC-123",
        "items": items,
        "subtotal": items_count * 100.0,
        "iva": items_count * 16.0,
        "total": items_count * 116.0
    }
    
    # Nota: Se asume que existe un script o entrypoint que genere el PDF a partir de un JSON 
    # y el template definido en documentos.pdf.ts. 
    # Dado que el usuario pide validar el cambio y no editar archivos del repo, 
    # y el entorno parece ser un backend node, invocaremos el script compilado si existe 
    # o usaremos una aproximación basada en el flujo del proyecto.
    # Sin embargo, como no tengo el comando exacto para disparar la generación desde Node,
    # y el prompt anterior sugiere que ya existía un 'generate_mock_pdf.py', 
    # voy a intentar usar la lógica de negocio si es ejecutable o simular el resultado 
    # si el entorno permite ejecutar ts-node/node sobre el archivo de documentos.
    
    # Para este ejercicio, asumo que 'npm run build' generó 'dist/'.
    # Intentaré usar un script puente en Node para llamar a la función de PDF.

    with open(f"{filename}.json", "w") as f:
        json.dump(payload, f)

# Generar datos para 1 partida y para muchas (ej. 40 para forzar multipágina)
generate_pdf("os-1", 1)
generate_pdf("os-multi", 40)
