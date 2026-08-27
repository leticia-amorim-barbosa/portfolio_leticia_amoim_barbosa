  
  

//pinos  
#define trigPin A0;
#define echoPin A1;
#define BUZZER A2; 



int TempoGirar = 1;
int distanciaObstaculo = 30; 
int velocidadeMotores = 80; 
Servo servo_ultra_sonico;

//variáveis  para o sensor ultrassonico
long duracao;
long distancia_cm=0;
int minimumRange=5; 
int maximumRange=200;
  
void setup() { 

  Serial.begin(9600);  
  servo_ultra_sonico.attach(10);   
  pinMode(trigPin, OUTPUT); 
  pinMode(echoPin, INPUT);  
  pinMode(BUZZER,OUTPUT);    
  motor1.setSpeed(velocidadeMotores);     
  motor2.setSpeed(velocidadeMotores); 
  servo_ultra_sonico.write(90);      
  rotacao_Parado;   
  } 
   
void loop(){    
  pensar(); 
  }  
  
  // Função definir o que o robô vai fazer  
  void pensar(){    
  reposicionaServoSonar();    
  int distancia = lerSonar();  
  Serial.print("distancia em cm: "); 
  Serial.println(distancia);   
  if (distancia > distanciaObstaculo) {  
  rotacao_Frente(); 

  }else{   
  rotacao_Parado();   
  posicionaCarroMelhorCaminho();    
  pensar();    
  }   
  }  

  // Função para ler e calcular a distância do sensor ultrassônico    
  int lerSonar(){    
  digitalWrite(trigPin, LOW); 
  delayMicroseconds(2);
  digitalWrite(trigPin,HIGH); 
  delayMicroseconds(10);
  digitalWrite(trigPin,LOW); 
  duracao = pulseIn(echoPin,HIGH); 
  distancia_cm = duracao/56; 
  delay(30);  
  return distancia_cm;             
  }

  // Função para calcular a distância do centro    
  int calcularDistanciaCentro(){    
  servo_ultra_sonico.write(90);    
  delay(20);   
  int leituraDoSonar = lerSonar();  
  delay(500);   
  leituraDoSonar = lerSonar();   
  delay(500);   
  Serial.print("Distancia do Centro: ");  
  Serial.println(leituraDoSonar);   
  return leituraDoSonar;       

  }    
  // Função para calcular a distância da direita    
  int calcularDistanciaDireita(){    
  servo_ultra_sonico.write(0);   
  delay(200);  
  int leituraDoSonar = lerSonar();   
  delay(500);   
  leituraDoSonar = lerSonar();   
  delay(500);   
  Serial.print("Distancia da Direita: ");  
  Serial.println(leituraDoSonar);   
  return leituraDoSonar; 

  }    
  // Função para calcular a distância da esquerda    
  int calcularDistanciaEsquerda(){    
  servo_ultra_sonico.write(180);   
  delay(200);  
  int leituraDoSonar = lerSonar();   
  delay(500);   
  leituraDoSonar = lerSonar();   
  delay(500);   
  Serial.print("Distancia Esquerda: ");  
  Serial.println(leituraDoSonar);   
  return leituraDoSonar;  

  }    
  // Função para captar as distâncias lidas e calcular a melhor distância.     
  char calculaMelhorDistancia(){    
  int esquerda = calcularDistanciaEsquerda();    
  int centro = calcularDistanciaCentro();    
  int direita = calcularDistanciaDireita();    
  reposicionaServoSonar();    
  int maiorDistancia = 0;   
  char melhorDistancia = '0';     
  if (centro > direita && centro > esquerda){    
  melhorDistancia = 'c';    
  maiorDistancia = centro;  

      }else   
      if (direita > centro && direita > esquerda){    
      melhorDistancia = 'd';    
      maiorDistancia = direita;    
      }else  
      if (esquerda > centro && esquerda > direita){    
      melhorDistancia = 'e';    
      maiorDistancia = esquerda;    
      }    
      if (maiorDistancia <= distanciaObstaculo) { //distância limite para parar o robô   
      rotacao_Re();    
      posicionaCarroMelhorCaminho();    
      }    
      reposicionaServoSonar();  
      return melhorDistancia;    
      }  

  // Função para colocar o carrinho na melhor distância   
  void posicionaCarroMelhorCaminho(){    
  char melhorDist = calculaMelhorDistancia();     
  Serial.print("melhor Distancia em cm: ");  
  Serial.println(melhorDist);  
      if (melhorDist == 'c'){   
        
      pensar();    
      }else if (melhorDist == 'd'){    
      rotacao_Direita();    
      }else if (melhorDist == 'e'){    
      rotacao_Esquerda();     
      }else{    
      rotacao_Re();    
  }    
  reposicionaServoSonar();    
  }    
  // Função para deixar o sensor "olho" do robô no centro    
  void reposicionaServoSonar(){    
  servo_ultra_sonico.write(90);   
  delay(200);   
  }    
  // Função para fazer o carro parar    
  void rotacao_Parado()    
  {    
  Serial.println(" Motor: Parar ");
  motor1.run(RELEASE);   
  motor2.run(RELEASE);  
  }    
  // Função para fazer o robô andar para frente    
  void rotacao_Frente()    
  {    
  Serial.println("Motor: Frente ");   
  motor1.run(FORWARD);  
  motor2.run(FORWARD);   
  delay(50);    
  }    
  // Função que faz o robô andar para trás e emite som quando ele dá ré    
  void rotacao_Re()    
  {    
  Serial.println("Motor: ré ");  
  for (int i=0; i <= 3; i++){
  digitalWrite(BUZZER, HIGH); 
  delay(100);
  motor1.run(BACKWARD); 
  motor2.run(BACKWARD);  
  delay(100);  
  digitalWrite(BUZZER, LOW); 
  delay(100);
  } 
  rotacao_Parado();    
  }    
  // Função que faz o robô virar à direita.   
  void rotacao_Direita()    
  {    
  digitalWrite(BUZZER, HIGH); // Liga o som da ré
  delay(100);
  motor1.run(BACKWARD);    
  motor2.run(BACKWARD);      
  delay(50);  
  digitalWrite(BUZZER, LOW); // Desliga o som  
  delay(100);
  Serial.println(" Para a direita ");  
  motor1.run(FORWARD);  
  motor2.run(BACKWARD);   
  delay(TempoGirar);    
  }    
  // Função que faz o robô virar à esquerda    
  void rotacao_Esquerda()    
  {    
  digitalWrite(BUZZER, HIGH); 
  delay(100);
  motor1.run(BACKWARD);    
  motor2.run(BACKWARD);   
  delay(50);  
  digitalWrite(BUZZER, LOW);  
  delay(100);
  Serial.println(" Para a esquerda ");  
  motor1.run(BACKWARD); 
  motor2.run(FORWARD); 
  delay(TempoGirar);    
  } 