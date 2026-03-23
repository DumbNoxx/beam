{
  description = "beam socket server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        nativeBuildInputs = [
          pkgs.bun
          pkgs.nodePackages.typescript-language-server
          pkgs.nodePackages.typescript
        ];
        buildInputs = with pkgs; [ ];
      in
      {
        devShells.default = pkgs.mkShell { inherit nativeBuildInputs buildInputs; };

      }
    );
}
