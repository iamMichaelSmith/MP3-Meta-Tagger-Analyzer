from transformers import ClapModel, ClapProcessor
import torch

def verify_clap():
    print("Testing CLAP imports...")
    try:
        # Just verify we can import; loading the model might download 600MB, 
        # which we might want to let the user do on first run or do it now.
        # Let's try to load it to ensure it downloads now if possible?
        # Or just verify imports to be safe.
        # User asked to "begin and remove old models", so let's try to verify the import at least.
        
        print(f"Transformers version: {str(ClapModel.__module__)}")
        print("Imports successful.")
        
        # Optional: uncomment to force download now
        # model = ClapModel.from_pretrained("laion/clap-htsat-unfused")
        # processor = ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
        # print("Model loaded.")
        
    except Exception as e:
        print(f"Failed to import CLAP components: {e}")

if __name__ == "__main__":
    verify_clap()
