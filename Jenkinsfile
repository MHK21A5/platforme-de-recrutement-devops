pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Repository checkout successful'
            }
        }

        stage('Inspect Project') {
            steps {
                sh 'pwd'
                sh 'ls -la'
                sh 'ls -la backend'
                sh 'ls -la frontend'
            }
        }
    }
}