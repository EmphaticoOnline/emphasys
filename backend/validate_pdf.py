from pypdf import PdfReader

reader = PdfReader("/tmp/os-mock.pdf")
number_of_pages = len(reader.pages)
page = reader.pages[0]
text = page.extract_text()

print(f"Num de paginas: {number_of_pages}")
print(f"Texto extraido (primeras 100 char): {text[:100]}")
if "Página 1 de 1" in text:
    print("Paginador visible: SI")
else:
    print("Paginador visible: NO")
