#!/bin/bash
if [ -d "/opt/pgdata" ]; then
  if ! LD_LIBRARY_PATH=/opt/pg/usr/lib/x86_64-linux-gnu:/opt/pg/usr/lib /opt/pg/usr/lib/postgresql/15/bin/pg_isready -h localhost -q; then
    mkdir -p /var/run/postgresql
    chown -R postgres:postgres /var/run/postgresql /opt/pgdata 2>/dev/null || true
    su - postgres -c "LD_LIBRARY_PATH=/opt/pg/usr/lib/x86_64-linux-gnu:/opt/pg/usr/lib /opt/pg/usr/lib/postgresql/15/bin/pg_ctl -D /opt/pgdata -l /tmp/pg.log start"
    sleep 1
  fi
fi
