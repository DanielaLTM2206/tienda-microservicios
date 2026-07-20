-- Se ejecuta una sola vez al inicializar el volumen de PostgreSQL
-- (docker-entrypoint-initdb.d). Crea una base de datos por microservicio
-- para eliminar el schema compartido: dos servicios con synchronize:true
-- sobre la misma BD es una condicion de carrera al arrancar.
CREATE DATABASE pedidos_db OWNER app;
CREATE DATABASE productos_db OWNER app;
