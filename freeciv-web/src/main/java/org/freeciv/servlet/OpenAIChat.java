package org.freeciv.servlet;

import com.theokanning.openai.completion.chat.*;
import com.theokanning.openai.service.OpenAiService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;


/**
 * OpenAI chat
 *
 * URL: /openai_chat
 */
@RestController
public class OpenAIChat {
    private static final Logger logger = LoggerFactory.getLogger(OpenAIChat.class);

    private final String model = "gpt-4o";

    @Value("${openai.key:}")
    private String openaiKey;

    @PostMapping("/openai_chat")
    public ResponseEntity<String> chatWithOpenAI(@RequestBody String messageBody) {
        try {
            String message = new String(Base64.getDecoder().decode(messageBody));

            logger.info("OpenAI message: {}", message);

            if (openaiKey == null || openaiKey.equals("")) {
                logger.warn("OpenAI key missing.");
                return ResponseEntity.ok().build();
            }

            OpenAiService service = new OpenAiService(openaiKey, Duration.ofSeconds(60));

            List<ChatMessage> messages = new ArrayList<>();

            // Player and game information to enhance the LLM response
            String fcivInfo = """
            You are an assistant in the game FreecivWorld.net, a 3D browser-based fork of Freeciv. Answer questions concisely and provide helpful tips. Max 100 words. 
            New cities are built using the shortcut 'B' or by right-clicking on a Settler unit and selecting 'Build city.' Units move with the 'G' (Goto) command or arrow keys. 
            
            Common Keyboard Shortcuts:
              - a: Auto-settler (settler/worker units).
              - b: Build city (settler units).
              - f: Fortify unit (military units) / Build fortress (settler/worker units).
              - g: Go to tile (left-click to select target).
              - h: Set unit's home city (to current tile's city).
              - i: Build irrigation or convert terrain (settler/worker units).
              - m: Build mine or convert terrain (settler/worker units).
              - N: Explode nuclear weapon.
              - p: Clean pollution (settler/worker units).
              - P: Pillage terrain.
              - r: Build road/railroad (settler/worker units).
              - s: Sentry unit.
              - S: Unsentry all units on tile.
              - L: Airlift unit to a city.
              - u: Unload unit from transporter.
              - x: Auto-explore.
            
            Mouse Controls:
              - Middle-click: Get map tile information.
              - Left-click: Select units or cities.
              - Right-click: Move the map.
              - Left-click and drag: Change view angle.
        """;

            ChatMessage systemMessage = new SystemMessage(fcivInfo);

            messages.add(systemMessage);


            for (String submessage : message.split(";")) {
                UserMessage userchat = new UserMessage(submessage);
                messages.add(userchat);
            }

            ChatCompletionRequest completionRequest = ChatCompletionRequest.builder()
                    .messages(messages)
                    .maxTokens(16384)
                    .model(model)
                    .build();
            List<ChatCompletionChoice> choices = service.createChatCompletion(completionRequest).getChoices();
            for (ChatCompletionChoice choice : choices) {
                return ResponseEntity.ok()
                        .header("Content-Type", "application/json")
                        .body(String.format("{\"message\": \"%s\"}", choice.getMessage().getContent()));
            }

            return ResponseEntity.ok().build();

        } catch (Exception erro) {
            logger.error("Error in OpenAI chat: {}", erro.getMessage(), erro);
            return ResponseEntity.ok().build();
        }
    }

}
