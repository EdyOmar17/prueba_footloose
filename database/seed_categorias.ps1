# Script de carga inicial de categorías desde CSV
$csvPath = "c:\Users\edyre\OneDrive\Desktop\prueba_footlose\categorias_test(Hoja1).csv"
$connString = "Server=.;Database=inventario_db;Integrated Security=True;TrustServerCertificate=True;"

$connection = New-Object System.Data.SqlClient.SqlConnection($connString)
$connection.Open()

$command = $connection.CreateCommand()
$command.CommandText = "DELETE FROM categoria;"
$command.ExecuteNonQuery() | Out-Null

$csv = Import-Csv -Path $csvPath -Delimiter ';'

$table = New-Object System.Data.DataTable
[void]$table.Columns.Add("id_categoria", [string])
[void]$table.Columns.Add("nombre_categoria", [string])
[void]$table.Columns.Add("activo", [int])

foreach ($row in $csv) {
    $r = $table.NewRow()
    $r["id_categoria"] = $row.Id_categoria.Trim()
    $r["nombre_categoria"] = $row.nombre_categoria.Trim()
    $r["activo"] = [int]$row.activo
    $table.Rows.Add($r)
}

$bulkCopy = New-Object System.Data.SqlClient.SqlBulkCopy($connection)
$bulkCopy.DestinationTableName = "categoria"
$bulkCopy.ColumnMappings.Add("id_categoria", "id_categoria") | Out-Null
$bulkCopy.ColumnMappings.Add("nombre_categoria", "nombre_categoria") | Out-Null
$bulkCopy.ColumnMappings.Add("activo", "activo") | Out-Null

$bulkCopy.WriteToServer($table)
$connection.Close()

Write-Host "Se importaron $($table.Rows.Count) categorias exitosamente."
