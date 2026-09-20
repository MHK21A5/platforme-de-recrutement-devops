pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Repository checkout completed'
            }
        }

        stage('Clean Workspace') {
            steps {
                sh 'rm -rf backend/node_modules frontend/node_modules frontend/dist'
                sh 'rm -f .deployment-attempted .rollback-ready'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Backend Validation') {
            steps {
                dir('backend') {
                    sh 'node --check app.js'
                }
            }
        }

        stage('Backend Tests') {
            steps {
                dir('backend') {
                    sh 'npm test'
                }
            }
        }

        stage('Backend Security Audit') {
            steps {
                dir('backend') {
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Security Audit') {
            steps {
                dir('frontend') {
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Archive Frontend Build') {
            steps {
                archiveArtifacts artifacts: 'frontend/dist/**',
                                 fingerprint: true
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build \
                        -t recruitment-backend:${BUILD_NUMBER} \
                        -t recruitment-backend:latest \
                        ./backend

                    docker build \
                        -t recruitment-frontend:${BUILD_NUMBER} \
                        -t recruitment-frontend:latest \
                        ./frontend
                '''
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                script {
                    def deploy = {
                        withCredentials([
                            file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')
                        ]) {
                            sh '''
                                set +x
                                set -e
                                trap 'rm -f backend.env' EXIT
                                cp "$BACKEND_ENV_FILE" backend.env
                                chmod 600 backend.env

                                backend_previous=''
                                frontend_previous=''
                                if [ "$(docker inspect -f '{{.State.Running}}' recruitment-backend 2>/dev/null || true)" = 'true' ]; then
                                    backend_previous="$(docker inspect -f '{{.Image}}' recruitment-backend)"
                                    docker tag "$backend_previous" recruitment-backend:rollback
                                fi
                                if [ "$(docker inspect -f '{{.State.Running}}' recruitment-frontend 2>/dev/null || true)" = 'true' ]; then
                                    frontend_previous="$(docker inspect -f '{{.Image}}' recruitment-frontend)"
                                    docker tag "$frontend_previous" recruitment-frontend:rollback
                                fi
                                echo '========================================'
                                echo 'ROLLBACK SNAPSHOT'
                                echo '========================================'
                                echo "Backend image: ${backend_previous:-none}"
                                echo "Frontend image: ${frontend_previous:-none}"
                                echo '========================================'
                                if [ -n "$backend_previous" ] && [ -n "$frontend_previous" ]; then
                                    touch .rollback-ready
                                fi

                                # Compose 1.29.2 cannot recreate these newer Docker images.
                                # Remove only application containers before creating replacements.
                                touch .deployment-attempted
                                app_containers="$(docker-compose ps -q backend frontend)"
                                for container_id in $app_containers; do
                                    docker rm -f "$container_id"
                                done
                                for container in recruitment-backend recruitment-frontend; do
                                    if docker container inspect "$container" > /dev/null 2>&1; then
                                        docker rm -f "$container"
                                    fi
                                done

                                docker-compose up -d --no-deps backend frontend
                                docker-compose up -d --no-recreate
                                if [ "$GF_SMTP_ENABLED" = 'true' ]; then
                                    # A fresh Grafana container picks up the injected SMTP settings.
                                    grafana_containers="$(docker-compose ps -q grafana)"
                                    for container_id in $grafana_containers; do
                                        docker rm -f "$container_id"
                                    done
                                    docker-compose up -d --no-deps grafana
                                fi
                            '''
                        }
                    }

                    // Add these credentials and set GRAFANA_EMAIL_ENABLED=true when SMTP is ready.
                    if (env.GRAFANA_EMAIL_ENABLED == 'true') {
                        if (!env.GF_SMTP_HOST?.trim() || !env.GF_SMTP_FROM_ADDRESS?.trim()) {
                            error 'Set GF_SMTP_HOST and GF_SMTP_FROM_ADDRESS before enabling Grafana email.'
                        }
                        withCredentials([
                            string(credentialsId: 'grafana-smtp-user', variable: 'GF_SMTP_USER'),
                            string(credentialsId: 'grafana-smtp-password', variable: 'GF_SMTP_PASSWORD'),
                            string(credentialsId: 'grafana-alert-email', variable: 'GF_ALERT_EMAIL')
                        ]) {
                            withEnv(['GF_SMTP_ENABLED=true']) { deploy() }
                        }
                    } else {
                        withEnv(['GF_SMTP_ENABLED=false']) { deploy() }
                    }
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -e
                    sleep 5
                    echo '========================================'
                    echo 'DEPLOYMENT VERIFICATION'
                    echo '========================================'

                    echo '[1/4] Checking container state'
                    docker ps

                    backend_running="$(docker inspect -f '{{.State.Running}}' recruitment-backend 2>/dev/null || true)"
                    frontend_running="$(docker inspect -f '{{.State.Running}}' recruitment-frontend 2>/dev/null || true)"
                    echo 'Container status:'
                    echo "- recruitment-backend: ${backend_running:-not running}"
                    echo "- recruitment-frontend: ${frontend_running:-not running}"

                    if [ "$backend_running" != "true" ]; then
                        echo 'ERROR: recruitment-backend is not running'
                        docker logs recruitment-backend || true
                        exit 1
                    fi

                    if [ "$frontend_running" != "true" ]; then
                        echo 'ERROR: recruitment-frontend is not running'
                        docker logs recruitment-frontend || true
                        exit 1
                    fi

                    echo '[2/4] Waiting for frontend readiness'
                    for i in $(seq 1 10); do
                        echo "Frontend readiness attempt $i/10..."
                        if curl --fail --silent --show-error http://localhost:8081/ > /dev/null; then
                            echo 'Frontend HTTP check: PASS'
                            echo 'URL: http://localhost:8081/'
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo 'Frontend HTTP check: FAIL'
                            echo 'ERROR: recruitment-frontend did not become ready'
                            docker logs recruitment-frontend || true
                            exit 1
                        fi

                        echo 'Frontend not ready yet. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo '[3/4] Waiting for backend readiness'
                    for i in $(seq 1 10); do
                        echo "Backend TCP readiness attempt $i/10..."
                        if bash -c 'echo > /dev/tcp/127.0.0.1/5000' 2>/dev/null; then
                            echo 'Backend TCP check: PASS'
                            echo 'Port: 5000'
                            break
                        fi

                        if [ "$i" -eq 10 ]; then
                            echo 'Backend TCP check: FAIL'
                            echo 'ERROR: recruitment-backend did not become ready'
                            docker logs recruitment-backend || true
                            exit 1
                        fi

                        echo 'Backend not ready yet. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo '[3b/4] Checking backend Prometheus metrics'
                    if ! metrics_output="$(curl --fail --silent --show-error http://localhost:5000/metrics)"; then
                        echo 'Backend Prometheus metrics: FAIL'
                        docker logs recruitment-backend || true
                        exit 1
                    fi
                    if ! echo "$metrics_output" | grep -q '^# HELP http_requests_total ' ||
                       ! echo "$metrics_output" | grep -q '^# HELP recruitment_backend_info '; then
                        echo 'Backend Prometheus metrics: FAIL (required metrics missing)'
                        exit 1
                    fi
                    echo 'Backend Prometheus metrics: PASS'

                    echo '[4/4] Checking Docker health status'
                    for i in $(seq 1 10); do
                        backend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-backend 2>/dev/null || true)"
                        frontend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-frontend 2>/dev/null || true)"
                        echo "Health status attempt $i/10"
                        echo "- backend: ${backend_health:-unknown}"
                        echo "- frontend: ${frontend_health:-unknown}"

                        if [ "$backend_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-backend is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-backend || true
                            docker logs recruitment-backend || true
                            exit 1
                        fi
                        if [ "$frontend_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-frontend is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-frontend || true
                            docker logs recruitment-frontend || true
                            exit 1
                        fi
                        if [ "$backend_health" = 'healthy' ] && [ "$frontend_health" = 'healthy' ]; then
                            break
                        fi
                        if [ "$i" -eq 10 ]; then
                            echo 'ERROR: Docker health checks did not become healthy'
                            if [ "$backend_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-backend || true
                                docker logs recruitment-backend || true
                            fi
                            if [ "$frontend_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-frontend || true
                                docker logs recruitment-frontend || true
                            fi
                            exit 1
                        fi
                        echo 'Health checks are starting. Waiting 3 seconds...'
                        sleep 3
                    done

                    echo 'Health status:'
                    echo '- recruitment-backend: healthy'
                    echo '- recruitment-frontend: healthy'
                    echo '========================================'
                    echo 'DEPLOYMENT VERIFICATION SUCCESS'
                    echo '========================================'
                    echo 'Backend container: RUNNING'
                    echo 'Frontend container: RUNNING'
                    echo 'Backend TCP: PASS'
                    echo 'Frontend HTTP: PASS'
                    echo 'Backend health: HEALTHY'
                    echo 'Frontend health: HEALTHY'
                    echo 'Application URL: http://localhost:8081'
                    echo 'Backend URL: http://localhost:5000'
                    echo '========================================'

                    echo '========================================'
                    echo 'MONITORING STACK STATUS'
                    echo '========================================'
                    for service in recruitment-prometheus recruitment-grafana recruitment-node-exporter recruitment-cadvisor recruitment-loki recruitment-promtail; do
                        running="$(docker inspect -f '{{.State.Running}}' "$service" 2>/dev/null || true)"
                        health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}not configured{{end}}' "$service" 2>/dev/null || true)"
                        echo "- $service: running=${running:-unknown}, health=${health:-unknown}"
                    done

                    for i in $(seq 1 10); do
                        prometheus_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-prometheus 2>/dev/null || true)"
                        grafana_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-grafana 2>/dev/null || true)"
                        echo "Monitoring health attempt $i/10: prometheus=${prometheus_health:-unknown}, grafana=${grafana_health:-unknown}"

                        if [ "$prometheus_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-prometheus is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-prometheus || true
                            docker logs recruitment-prometheus || true
                            exit 1
                        fi
                        if [ "$grafana_health" = 'unhealthy' ]; then
                            echo 'ERROR: recruitment-grafana is unhealthy'
                            docker inspect -f '{{json .State.Health}}' recruitment-grafana || true
                            docker logs recruitment-grafana || true
                            exit 1
                        fi
                        if [ "$prometheus_health" = 'healthy' ] && [ "$grafana_health" = 'healthy' ]; then
                            break
                        fi
                        if [ "$i" -eq 10 ]; then
                            echo 'ERROR: monitoring services did not become healthy'
                            if [ "$prometheus_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-prometheus || true
                                docker logs recruitment-prometheus || true
                            fi
                            if [ "$grafana_health" != 'healthy' ]; then
                                docker inspect -f '{{json .State.Health}}' recruitment-grafana || true
                                docker logs recruitment-grafana || true
                            fi
                            exit 1
                        fi
                        echo 'Waiting 3 seconds for monitoring services...'
                        sleep 3
                    done

                    loki_running="$(docker inspect -f '{{.State.Running}}' recruitment-loki 2>/dev/null || true)"
                    promtail_running="$(docker inspect -f '{{.State.Running}}' recruitment-promtail 2>/dev/null || true)"
                    if [ "$loki_running" != 'true' ]; then
                        echo 'ERROR: recruitment-loki is not running'
                        docker logs recruitment-loki || true
                        exit 1
                    fi
                    if [ "$promtail_running" != 'true' ]; then
                        echo 'ERROR: recruitment-promtail is not running'
                        docker logs recruitment-promtail || true
                        exit 1
                    fi

                    for i in $(seq 1 15); do
                        if curl --fail --silent http://localhost:3100/ready > /dev/null; then
                            echo 'Loki health: HEALTHY'
                            break
                        fi
                        if [ "$i" -eq 15 ]; then
                            echo 'ERROR: Loki did not become ready'
                            docker logs recruitment-loki || true
                            exit 1
                        fi
                        echo "Waiting for Loki readiness... attempt $i/15"
                        sleep 3
                    done

                    echo 'Prometheus health: HEALTHY'
                    echo 'Grafana health: HEALTHY'
                    echo 'Promtail: RUNNING'
                    echo 'Prometheus URL: http://localhost:9090'
                    echo 'Grafana URL: http://localhost:3000'
                    echo 'Loki URL: http://localhost:3100'

                    backend_stable="$(docker inspect -f '{{.Image}}' recruitment-backend)"
                    frontend_stable="$(docker inspect -f '{{.Image}}' recruitment-frontend)"
                    docker tag "$backend_stable" recruitment-backend:stable
                    docker tag "$frontend_stable" recruitment-frontend:stable
                    echo '========================================'
                    echo 'STABLE RELEASE UPDATED'
                    echo '========================================'
                    echo "Backend image: $backend_stable"
                    echo "Frontend image: $frontend_stable"
                    echo '========================================'
                    rm -f .deployment-attempted .rollback-ready
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD pipeline completed successfully. Application deployed.'
        }

        failure {
            echo 'CI pipeline failed. Check the logs.'
            script {
                if (fileExists('.deployment-attempted')) {
                    try {
                        withCredentials([
                            file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')
                        ]) {
                            def rollbackStatus = sh(returnStatus: true, script: '''
                                set +x
                                set -e
                                rollback_cleanup() {
                                    status=$?
                                    rm -f backend.env
                                    if [ "$status" -ne 0 ]; then
                                        echo '========================================'
                                        echo 'AUTOMATIC ROLLBACK FAILED'
                                        echo '========================================'
                                        docker ps -a || true
                                        docker logs --tail 100 recruitment-backend || true
                                        docker logs --tail 100 recruitment-frontend || true
                                    fi
                                }
                                trap rollback_cleanup EXIT
                                cp "$BACKEND_ENV_FILE" backend.env
                                chmod 600 backend.env

                                if [ ! -f .rollback-ready ] ||
                                   ! docker image inspect recruitment-backend:rollback > /dev/null 2>&1 ||
                                   ! docker image inspect recruitment-frontend:rollback > /dev/null 2>&1; then
                                    echo '========================================'
                                    echo 'ROLLBACK SKIPPED'
                                    echo 'Previous application images unavailable'
                                    echo '========================================'
                                    exit 0
                                fi

                                docker tag recruitment-backend:rollback recruitment-backend:latest
                                docker tag recruitment-frontend:rollback recruitment-frontend:latest
                                app_containers="$(docker-compose ps -q backend frontend)"
                                for container_id in $app_containers; do
                                    docker rm -f "$container_id"
                                done
                                for container in recruitment-backend recruitment-frontend; do
                                    if docker container inspect "$container" > /dev/null 2>&1; then
                                        docker rm -f "$container"
                                    fi
                                done
                                docker-compose up -d --no-deps backend frontend

                                for i in $(seq 1 10); do
                                    backend_running="$(docker inspect -f '{{.State.Running}}' recruitment-backend 2>/dev/null || true)"
                                    frontend_running="$(docker inspect -f '{{.State.Running}}' recruitment-frontend 2>/dev/null || true)"
                                    backend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-backend 2>/dev/null || true)"
                                    frontend_health="$(docker inspect -f '{{.State.Health.Status}}' recruitment-frontend 2>/dev/null || true)"
                                    if [ "$backend_running" = 'true' ] && [ "$frontend_running" = 'true' ] &&
                                       [ "$backend_health" = 'healthy' ] && [ "$frontend_health" = 'healthy' ] &&
                                       curl --fail --silent http://localhost:5000/health > /dev/null &&
                                       curl --fail --silent http://localhost:8081/ > /dev/null; then
                                        echo '========================================'
                                        echo 'AUTOMATIC ROLLBACK SUCCESSFUL'
                                        echo '========================================'
                                        echo 'Previous backend image restored'
                                        echo 'Previous frontend image restored'
                                        echo 'Backend HTTP: PASS'
                                        echo 'Frontend HTTP: PASS'
                                        echo 'Backend health: HEALTHY'
                                        echo 'Frontend health: HEALTHY'
                                        echo 'Application restored to previous release'
                                        echo '========================================'
                                        exit 0
                                    fi
                                    if [ "$i" -lt 10 ]; then
                                        echo "Waiting for application rollback... attempt $i/10"
                                        sleep 3
                                    fi
                                done
                                exit 1
                            ''')
                            if (rollbackStatus != 0) {
                                echo 'Rollback did not restore the application; the release remains failed.'
                            }
                        }
                    } catch (ignored) {
                        echo '========================================'
                        echo 'AUTOMATIC ROLLBACK FAILED'
                        echo '========================================'
                        echo 'Rollback handler could not start.'
                        sh(returnStatus: true, script: '''
                            docker ps -a
                            docker logs --tail 100 recruitment-backend || true
                            docker logs --tail 100 recruitment-frontend || true
                        ''')
                    }
                } else {
                    echo 'Deployment was not attempted; rollback is not needed.'
                }
            }
        }
    }
}
